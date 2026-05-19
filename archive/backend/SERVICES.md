# 🔧 Backend Services - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [GameGeneratorService](#gamegeneratorservice)
- [StatisticsService](#statisticsservice)
- [NotificationService](#notificationservice)
- [TeamBalancerService](#teambalancerservice)
- [Padrão de Uso](#padrão-de-uso)

---

## Visão Geral

Services contêm a lógica de negócio principal. Cada service é responsável por um domínio específico.

```typescript
// Service = Lógica de negócio isolada e reutilizável
@Injectable()
export class GameService {
    // Métodos públicos para controllers chamarem
    // Métodos privados para validação/helpers
}
```

**Localização:** `backend/src/services/`

---

## GameGeneratorService

### Propósito

Gera automaticamente jogos a partir de horários recorrentes (schedules).

### Quando Executa

**Cron Job:** Diariamente às 00:00 (midnight)

```typescript
// backend/src/cron/gameGenerator.cron.ts
@Cron('0 0 * * *')  // Executa toda meia-noite
async handleGameGeneration() {
    await this.gameGeneratorService.generateGames();
}
```

### Como Funciona

```
1. Buscar todos os SCHEDULES (horários recorrentes)

2. Para cada schedule, verificar:
   - Próximos 30 dias (configurável em GAME_GENERATION_DAYS_AHEAD)
   - Quais datas o schedule ocorre (segunda, quarta, etc)

3. Para cada data, criar um GAME:
   - Verificar se já existe game para esse horário
   - Se não, criar novo

4. Notificar usuários
```

### Exemplo de Uso

```typescript
@Injectable()
export class GameGeneratorService {

    constructor(
        private scheduleRepository: ScheduleRepository,
        private gameRepository: GameRepository,
        private notificationService: NotificationService
    ) {}

    async generateGames(): Promise<void> {
        const daysAhead = parseInt(process.env.GAME_GENERATION_DAYS_AHEAD) || 30;
        const endDate = addDays(new Date(), daysAhead);

        const schedules = await this.scheduleRepository.findActive();

        for (const schedule of schedules) {
            const dates = this.calculateScheduleDates(
                schedule,
                new Date(),
                endDate
            );

            for (const date of dates) {
                const existingGame = await this.gameRepository.findOne({
                    where: {
                        schedule: { id: schedule.id },
                        date: date
                    }
                });

                if (!existingGame) {
                    const game = await this.gameRepository.save({
                        scheduleId: schedule.id,
                        date: date,
                        time: schedule.time,
                        duration: schedule.duration,
                        maxPlayers: schedule.maxPlayers,
                        dailyPrice: schedule.dailyPrice,
                        status: 'SCHEDULED'
                    });

                    // Notificar membros do schedule
                    await this.notificationService.notifyMembers(
                        schedule.id,
                        `New game scheduled for ${date}`
                    );
                }
            }
        }
    }

    private calculateScheduleDates(
        schedule: Schedule,
        startDate: Date,
        endDate: Date
    ): Date[] {
        const dates: Date[] = [];
        const config = JSON.parse(schedule.recurrenceConfig);

        if (schedule.recurrenceType === 'DAILY') {
            for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
                dates.push(d);
            }
        } else if (schedule.recurrenceType === 'WEEKLY') {
            // config.days = ['MONDAY', 'WEDNESDAY']
            for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
                const dayName = format(d, 'EEEE').toUpperCase();
                if (config.days.includes(dayName)) {
                    dates.push(d);
                }
            }
        } else if (schedule.recurrenceType === 'CUSTOM') {
            // config.specific_dates = ['2024-01-15', '2024-01-20']
            for (const dateStr of config.specific_dates) {
                const date = parseISO(dateStr);
                if (date >= startDate && date <= endDate) {
                    dates.push(date);
                }
            }
        }

        return dates;
    }
}
```

### Configuração

```env
# .env
GAME_GENERATION_DAYS_AHEAD=30
# Gera games para próximos 30 dias
```

---

## StatisticsService

### Propósito

Calcula e atualiza estatísticas agregadas de jogadores após cada jogo.

### Quando Executa

Chamado por `GameService.finalizeGame()` ou por Cloud Function `onGameComplete`.

### Como Funciona

```
1. Receber lista de jogadores que participaram

2. Para cada jogador:
   - Contar total de jogos
   - Somar gols, assists, saves
   - Contar quantas vezes foi MVP
   - Calcular taxa de presença

3. Atualizar/criar registros em USER_STATISTICS

4. Atualizar por schedule também (stats por horário específico)
```

### Exemplo de Uso

```typescript
@Injectable()
export class StatisticsService {

    constructor(
        private statsRepository: UserStatisticsRepository,
        private gameStatsRepository: GameStatsRepository
    ) {}

    async recalculateUserStats(userIds: string[]): Promise<void> {
        for (const userId of userIds) {
            // Stats globais
            await this.recalculateGlobalStats(userId);

            // Stats por schedule
            await this.recalculateScheduleStats(userId);
        }
    }

    private async recalculateGlobalStats(userId: string): Promise<void> {
        // Buscar todos os games deste jogador
        const games = await this.gameStatsRepository.find({
            where: { user: { id: userId } }
        });

        const stats = {
            totalGames: games.length,
            totalGoals: games.reduce((sum, g) => sum + (g.goals || 0), 0),
            totalAssists: games.reduce((sum, g) => sum + (g.assists || 0), 0),
            totalSaves: games.reduce((sum, g) => sum + (g.saves || 0), 0),
            bestPlayerCount: games.filter(g => g.isMvp).length,
            presenceRate: 1.0  // Todos os games aqui têm presença
        };

        // Atualizar ou criar
        await this.statsRepository.save({
            userId: userId,
            scheduleId: null,  // Global
            ...stats
        });
    }

    private async recalculateScheduleStats(userId: string): Promise<void> {
        // Agrupar por schedule
        const games = await this.gameStatsRepository.query(`
            SELECT DISTINCT gs.*, g.schedule_id
            FROM game_stats gs
            JOIN games g ON gs.game_id = g.id
            WHERE gs.user_id = $1
        `, [userId]);

        const bySchedule = new Map<string, any[]>();
        games.forEach(game => {
            if (!bySchedule.has(game.schedule_id)) {
                bySchedule.set(game.schedule_id, []);
            }
            bySchedule.get(game.schedule_id).push(game);
        });

        // Salvar para cada schedule
        for (const [scheduleId, scheduleGames] of bySchedule) {
            const stats = {
                totalGames: scheduleGames.length,
                totalGoals: scheduleGames.reduce((sum, g) => sum + (g.goals || 0), 0),
                bestPlayerCount: scheduleGames.filter(g => g.isMvp).length,
                presenceRate: 1.0
            };

            await this.statsRepository.save({
                userId: userId,
                scheduleId: scheduleId,
                ...stats
            });
        }
    }
}
```

### Quando Usar

```typescript
// Em GameService
async finalizeGame(gameId: string, stats: GameStatsInput[]): Promise<void> {
    // 1. Salvar stats
    await this.saveGameStats(gameId, stats);

    // 2. Recalcular user statistics
    const userIds = stats.map(s => s.userId);
    await this.statisticsService.recalculateUserStats(userIds);

    // 3. Cloud Function processa XP, badges
}
```

---

## NotificationService

### Propósito

Gerenciar notificações (in-app e push via FCM).

### Tipos de Notificações

| Tipo | Gatilho | Destinatário |
|------|---------|--------------|
| `GAME_CREATED` | Novo jogo criado | Membros do schedule |
| `GAME_CONFIRMED` | Confirmações fechadas | Todos confirmados |
| `GAME_STARTING_SOON` | 2 horas antes | Confirmados |
| `GAME_FINISHED` | Jogo finalizado | Participantes |
| `INVITE_RECEIVED` | Convite para grupo | User convidado |
| `BADGE_UNLOCKED` | Badge desbloqueado | User |

### Exemplo de Uso

```typescript
@Injectable()
export class NotificationService {

    constructor(
        private notificationRepository: NotificationRepository,
        private firebaseAdmin: admin.app.App,
        private userRepository: UserRepository
    ) {}

    async notifyGameCreated(game: Game): Promise<void> {
        // 1. Buscar membros do schedule
        const members = await this.userRepository.findScheduleMembers(
            game.schedule.id
        );

        // 2. Criar notificação in-app para cada
        const notifications = members.map(member => ({
            userId: member.id,
            type: 'GAME_CREATED',
            title: 'Novo jogo criado',
            message: `Novo jogo em ${game.schedule.field.name}`,
            data: {
                gameId: game.id,
                date: game.date,
                time: game.time
            }
        }));

        await this.notificationRepository.insertMany(notifications);

        // 3. Enviar push notifications via FCM
        const tokens = members
            .map(m => m.fcmToken)
            .filter(Boolean);

        if (tokens.length > 0) {
            await this.firebaseAdmin.messaging().sendMulticast({
                tokens: tokens,
                notification: {
                    title: 'Novo jogo',
                    body: `${game.schedule.name} - ${game.date}`
                },
                data: {
                    gameId: game.id,
                    type: 'GAME_CREATED'
                }
            });
        }
    }

    async notifyGameStartingSoon(gameId: string): Promise<void> {
        const game = await this.gameRepository.findById(gameId);
        const confirmations = await this.confirmationRepository.findByGame(gameId);

        const tokens = confirmations
            .map(c => c.user.fcmToken)
            .filter(Boolean);

        await this.firebaseAdmin.messaging().sendMulticast({
            tokens: tokens,
            notification: {
                title: 'Jogo começando!',
                body: `${game.schedule.name} em ${game.time}`
            }
        });
    }

    async createInAppNotification(
        userId: string,
        type: string,
        title: string,
        message: string,
        data?: Record<string, any>
    ): Promise<void> {
        await this.notificationRepository.save({
            userId,
            type,
            title,
            message,
            data,
            read: false
        });
    }
}
```

### Configuração

```env
# .env
FIREBASE_PROJECT_ID=futebadosparcas
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

---

## TeamBalancerService

### Propósito

Balancear times de forma justa usando AI/algoritmo.

### Algoritmo

```
Entrada: Lista de jogadores confirmados + seus níveis

1. Ordenar jogadores por nível (decrescente)

2. Draft alternado:
   - Time A pega melhor jogador
   - Time B pega melhor restante
   - ...

3. Garantir:
   - Um goleiro em cada time
   - Distribuição equilibrada de habilidade
```

### Exemplo de Uso

```typescript
@Injectable()
export class TeamBalancerService {

    async generateTeams(
        gameId: string,
        numberOfTeams: number,
        balanceTeams: boolean
    ): Promise<Team[]> {
        // 1. Buscar confirmações
        const confirmations = await this.confirmationRepository.findByGame(gameId);
        const players = confirmations.map(c => ({
            id: c.userId,
            name: c.user.name,
            level: c.user.level,
            position: c.position
        }));

        // 2. Balancear ou distribuir aleatoriamente
        let teams: { position: string; players: typeof players }[];

        if (balanceTeams) {
            teams = this.balanceBySkill(players, numberOfTeams);
        } else {
            teams = this.distributeRandomly(players, numberOfTeams);
        }

        // 3. Salvar times
        const savedTeams = [];
        for (let i = 0; i < teams.length; i++) {
            const team = await this.teamRepository.save({
                gameId: gameId,
                name: `Team ${i + 1}`,
                color: this.getTeamColor(i)
            });

            for (const player of teams[i].players) {
                await this.teamPlayerRepository.save({
                    teamId: team.id,
                    userId: player.id,
                    position: player.position
                });
            }

            savedTeams.push(team);
        }

        return savedTeams;
    }

    private balanceBySkill(
        players: any[],
        numberOfTeams: number
    ): any[] {
        // Separar goalkeepers
        const goalkeepers = players.filter(p => p.position === 'GOALKEEPER');
        const fieldPlayers = players.filter(p => p.position === 'FIELD')
            .sort((a, b) => b.level - a.level);  // Sort by level desc

        const teams = Array.from({ length: numberOfTeams }, () => ({
            position: 'FIELD',
            players: [],
            totalLevel: 0
        }));

        // Draft: alternate adding best remaining players
        for (const player of fieldPlayers) {
            const lowestTeam = teams.reduce((prev, current) =>
                current.totalLevel < prev.totalLevel ? current : prev
            );

            lowestTeam.players.push(player);
            lowestTeam.totalLevel += player.level;
        }

        // Distribuir goalkeepers
        for (let i = 0; i < goalkeepers.length; i++) {
            teams[i % numberOfTeams].players.push(goalkeepers[i]);
        }

        return teams;
    }

    private distributeRandomly(players: any[], numberOfTeams: number): any[] {
        const teams = Array.from({ length: numberOfTeams }, () => ({
            position: 'FIELD',
            players: []
        }));

        const shuffled = players.sort(() => Math.random() - 0.5);

        shuffled.forEach((player, index) => {
            teams[index % numberOfTeams].players.push(player);
        });

        return teams;
    }

    private getTeamColor(index: number): string {
        const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00'];
        return colors[index % colors.length];
    }
}
```

### Quando Usar

```typescript
// Em GameController
@Post(':id/teams')
async generateTeams(
    @Param('id') gameId: string,
    @Body() { numberOfTeams, balanceTeams }: GenerateTeamsDto
) {
    const teams = await this.teamBalancerService.generateTeams(
        gameId,
        numberOfTeams,
        balanceTeams
    );
    return { success: true, teams };
}
```

---

## Padrão de Uso

### Injeção de Dependência

```typescript
@Controller('games')
export class GameController {
    constructor(
        private gameService: GameService,
        private statisticsService: StatisticsService,
        private notificationService: NotificationService,
        private teamBalancerService: TeamBalancerService
    ) {}

    @Post()
    async create(@Body() dto: CreateGameDto) {
        return this.gameService.createGame(dto);
    }
}
```

### Tratamento de Erro

```typescript
@Injectable()
export class GameService {

    async createGame(data: CreateGameDto): Promise<Game> {
        try {
            this.validateData(data);
            const game = await this.gameRepository.save(data);
            return game;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw new BadRequestException(error.message);
            }
            throw error;  // Deixar para global handler
        }
    }
}
```

---

## Veja Também

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura de backend
- [CONTROLLERS.md](./CONTROLLERS.md) - Controllers que usam services
- [../API_REFERENCE.md](../API_REFERENCE.md) - Como os endpoints funcionam
- [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Dados que services manipulam

---

**Última atualização:** Dezembro 2025
