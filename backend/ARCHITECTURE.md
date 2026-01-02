# 🏛️ Backend Architecture - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Camadas](#camadas)
- [Padrões](#padrões)
- [Data Flow](#data-flow)
- [Error Handling](#error-handling)
- [Middlewares](#middlewares)
- [Scaling](#scaling)

---

## Visão Geral

Backend do Futeba dos Parças é uma API REST construída em **Express.js + TypeORM + PostgreSQL** seguindo padrões de **Clean Architecture** e **SOLID principles**.

```
┌─────────────────────────────────────┐
│  HTTP Requests                      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  MIDDLEWARE LAYER                   │
│  ├─ Authentication (JWT)            │
│  ├─ Error Handling                  │
│  ├─ Logging                         │
│  └─ Validation                      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  CONTROLLER LAYER                   │
│  ├─ GameController                  │
│  ├─ UserController                  │
│  ├─ StatisticsController            │
│  └─ ... mais controllers            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  SERVICE LAYER                      │
│  ├─ GameService                     │
│  ├─ StatisticsService               │
│  ├─ NotificationService             │
│  └─ TeamBalancerService             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  REPOSITORY LAYER                   │
│  (TypeORM Data Access)              │
│  ├─ GameRepository                  │
│  ├─ UserRepository                  │
│  └─ ... mais repos                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  DATABASE LAYER                     │
│  PostgreSQL 15+                     │
└─────────────────────────────────────┘
```

---

## Camadas

### 1. Controller Layer

Responsável por:
- Receber requisições HTTP
- Validar input (body, params, query)
- Chamar service apropriado
- Retornar resposta formatada

```typescript
// exemplo: GameController.ts
@Controller('games')
@UseGuards(JwtAuthGuard)
export class GameController {

    constructor(private gameService: GameService) {}

    @Get('upcoming')
    async getUpcomingGames(
        @Query('days') days: number = 7,
        @Query('limit') limit: number = 20,
        @Query('offset') offset: number = 0
    ) {
        const games = await this.gameService.getUpcomingGames(days, limit, offset);
        return { success: true, data: games };
    }

    @Post(':id/confirm')
    async confirmPresence(
        @Param('id') gameId: string,
        @Body() { position }: ConfirmPresenceDto,
        @Request() req
    ) {
        const result = await this.gameService.confirmPresence(
            gameId,
            req.user.id,
            position
        );
        return { success: true, data: result };
    }
}
```

**Responsabilidades:**
- ✅ HTTP plumbing (req, res, params, query)
- ✅ Validação de entrada (DTOs, decoradores)
- ✅ Autorização (Guards)
- ❌ Lógica de negócio
- ❌ Acesso a banco de dados

---

### 2. Service Layer

Responsável por:
- Lógica de negócio
- Orquestração entre repositórios
- Validações complexas
- Side effects (notificações, etc)

```typescript
// exemplo: GameService.ts
@Injectable()
export class GameService {

    constructor(
        private gameRepository: GameRepository,
        private statsService: StatisticsService,
        private notificationService: NotificationService,
        private teamBalancerService: TeamBalancerService
    ) {}

    async createGame(data: CreateGameDto): Promise<Game> {
        // 1. Validar dados
        this.validateGameData(data);

        // 2. Verificar conflitos
        const hasConflict = await this.gameRepository.checkTimeConflict(
            data.fieldId,
            data.date,
            data.time
        );
        if (hasConflict) {
            throw new ConflictException('Schedule conflict');
        }

        // 3. Criar jogo
        const game = await this.gameRepository.save(data);

        // 4. Side effects (async, não bloqueia resposta)
        this.notificationService.notifyGroupMembers(game);

        return game;
    }

    async finalizeGame(
        gameId: string,
        stats: GameStatsInput[]
    ): Promise<void> {
        // 1. Atualizar jogo
        await this.gameRepository.update(gameId, {
            status: 'FINISHED'
        });

        // 2. Salvar stats
        await this.gameRepository.saveStats(gameId, stats);

        // 3. Recalcular estatísticas de usuários
        await this.statsService.recalculateStats(
            stats.map(s => s.userId)
        );

        // 4. Cloud Function processa XP, badges, etc (async)
        // Emitido como evento Firestore
    }

    private validateGameData(data: CreateGameDto): void {
        if (!data.date) {
            throw new BadRequestException('Date is required');
        }
        if (data.date < new Date()) {
            throw new BadRequestException('Date must be in future');
        }
        if (data.maxPlayers < 4) {
            throw new BadRequestException('Minimum 4 players');
        }
    }
}
```

**Responsabilidades:**
- ✅ Lógica de negócio
- ✅ Orquestração de repositórios
- ✅ Validações complexas
- ✅ Cálculos e transformações
- ❌ Detalhes HTTP
- ❌ Detalhes do banco

---

### 3. Repository Layer

Responsável por:
- Operações CRUD
- Queries específicas do domínio
- Abstração do banco de dados

```typescript
// exemplo: GameRepository.ts
@Injectable()
export class GameRepository {

    constructor(
        @InjectRepository(Game)
        private repository: Repository<Game>
    ) {}

    async save(data: CreateGameDto): Promise<Game> {
        const game = this.repository.create(data);
        return await this.repository.save(game);
    }

    async findById(id: string): Promise<Game | null> {
        return await this.repository.findOne({
            where: { id },
            relations: ['schedule', 'confirmations', 'teams']
        });
    }

    async getUpcomingGames(
        days: number,
        limit: number,
        offset: number
    ): Promise<{ games: Game[]; total: number }> {
        const tomorrow = addDays(new Date(), 1);
        const endDate = addDays(new Date(), days);

        const [games, total] = await this.repository.findAndCount({
            where: {
                date: Between(tomorrow, endDate),
                status: In(['SCHEDULED', 'CONFIRMED'])
            },
            order: { date: 'ASC', time: 'ASC' },
            take: limit,
            skip: offset,
            relations: ['schedule', 'confirmations', 'field', 'location']
        });

        return { games, total };
    }

    async checkTimeConflict(
        fieldId: string,
        date: Date,
        startTime: string,
        endTime: string
    ): Promise<boolean> {
        const existing = await this.repository.findOne({
            where: {
                schedule: { field: { id: fieldId } },
                date: date,
                status: In(['SCHEDULED', 'CONFIRMED'])
            }
        });

        return !!existing;
    }

    async update(id: string, data: Partial<Game>): Promise<void> {
        await this.repository.update(id, data);
    }

    async saveStats(gameId: string, stats: GameStatsInput[]): Promise<void> {
        const gameStats = stats.map(stat => ({
            gameId,
            userId: stat.userId,
            goals: stat.goals,
            assists: stat.assists,
            saves: stat.saves,
            isMvp: stat.isMvp
        }));

        await this.repository.manager.insert(GameStats, gameStats);
    }
}
```

**Responsabilidades:**
- ✅ Operações CRUD
- ✅ Queries complexas
- ✅ Transformação para entities do banco
- ❌ Lógica de negócio
- ❌ Validações de business rule

---

### 4. Entity Layer

Modelos do banco de dados usando TypeORM.

```typescript
// exemplo: Game.ts
@Entity('games')
export class Game {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('date')
    date: Date;

    @Column('time')
    time: string;

    @Column({ type: 'varchar', length: 50 })
    status: 'SCHEDULED' | 'CONFIRMED' | 'FINISHED' | 'CANCELLED';

    @ManyToOne(() => Schedule)
    @JoinColumn({ name: 'schedule_id' })
    schedule: Schedule;

    @OneToMany(() => GameConfirmation, conf => conf.game, {
        cascade: true,
        eager: false
    })
    confirmations: GameConfirmation[];

    @OneToMany(() => Team, team => team.game, {
        cascade: true,
        eager: false
    })
    teams: Team[];

    @Column('int', { nullable: true })
    maxPlayers: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    dailyPrice: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

---

## Padrões

### Dependency Injection

Todos os serviços usam construtor DI:

```typescript
@Injectable()
export class GameService {
    constructor(
        private gameRepository: GameRepository,
        private statsService: StatisticsService,
        private notificationService: NotificationService
    ) {}
}
```

### Error Handling

Exceções customizadas para diferentes cenários:

```typescript
// Definir
export class GameNotFoundException extends NotFoundException {
    constructor(gameId: string) {
        super(`Game ${gameId} not found`);
    }
}

// Usar em Service
async findGame(id: string): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
        throw new GameNotFoundException(id);
    }
    return game;
}

// Middleware de erro trata automaticamente
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
    catch(exception: NotFoundException, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse();
        response.status(404).json({
            statusCode: 404,
            error: exception.message
        });
    }
}
```

### DTOs (Data Transfer Objects)

Validação automática com class-validator:

```typescript
export class CreateGameDto {
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @IsTimeString()
    @IsNotEmpty()
    time: string;

    @IsUUID()
    @IsNotEmpty()
    fieldId: string;

    @IsInt()
    @Min(4)
    @Max(50)
    @IsOptional()
    maxPlayers?: number;

    @IsDecimal({ decimal_digits: '2' })
    @IsOptional()
    dailyPrice?: number;
}

// Controller usa automaticamente
@Post()
async create(@Body() dto: CreateGameDto) {
    // dto é validado automaticamente
    // se inválido, retorna 400
    return this.gameService.createGame(dto);
}
```

---

## Data Flow

### Fluxo de Criar Jogo

```
1. POST /api/games

   ▼

2. GameController.createGame()
   - Valida CreateGameDto (automático)
   - Extrai usuário do JWT token
   - Chama GameService.createGame()

   ▼

3. GameService.createGame()
   - Valida regras de negócio
   - Checa conflitos de horário via GameRepository
   - Cria jogo via GameRepository.save()

   ▼

4. GameRepository.save()
   - TypeORM transforma DTO em Entity
   - INSERT na tabela games
   - Retorna Entity com ID

   ▼

5. Notificação async
   - NotificationService.notifyGroupMembers()
   - Query usuários do grupo
   - Envia notificações Firebase

   ▼

6. Resposta ao cliente
   - 201 Created
   - Body: { success: true, data: game }
```

### Fluxo de Finalizar Jogo (com Cloud Function)

```
1. POST /api/games/:id/stats

   ▼

2. GameController.finalizeGame()
   - Valida GameStatsDto
   - Chama GameService.finalizeGame()

   ▼

3. GameService.finalizeGame()
   - Atualiza status para FINISHED
   - Salva stats no banco (GameStats table)
   - Recalcula UserStatistics
   - Retorna resposta

   ▼

4. Firestore Trigger (Cloud Function)
   - onGameComplete listener
   - Lê stats do banco
   - Calcula XP por jogador
   - Verifica badges desbloqueadas
   - Atualiza Firestore (user XP, badges)
   - Auto-sinced para Android app via listener

   ▼

5. Android app
   - Observa mudanças em Firestore
   - UI atualiza automaticamente
   - Exibe animação de unlock (se badge)
```

---

## Error Handling

### Global Error Handler

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {

    constructor(private logger: Logger) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse();

        let statusCode = 500;
        let message = 'Internal server error';

        if (exception instanceof BadRequestException) {
            statusCode = 400;
            message = exception.getResponse()['message'];
        } else if (exception instanceof NotFoundException) {
            statusCode = 404;
            message = 'Resource not found';
        } else if (exception instanceof ConflictException) {
            statusCode = 409;
            message = exception.message;
        }

        this.logger.error(
            `${statusCode} ${message}`,
            exception instanceof Error ? exception.stack : ''
        );

        response.status(statusCode).json({
            statusCode,
            error: message,
            timestamp: new Date().toISOString()
        });
    }
}
```

### Validação

```typescript
// DTOs com validadores
export class CreateGameDto {
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @IsInt()
    @Min(4)
    @Max(50)
    maxPlayers: number;
}

// Class validator decorators
class CreateGameDto {
    @Validate(IsUniqueDateTimeConstraint, ['fieldId'])
    date: string;
}
```

---

## Middlewares

### Ordem de Execução

```typescript
app.use(helmet());              // 1. Headers de segurança
app.use(cors());                // 2. CORS
app.use(express.json());        // 3. Parse JSON
app.use(RequestLoggingMiddleware); // 4. Logging
app.use(AuthMiddleware);        // 5. JWT verification
app.use(routes);                // 6. Routes
app.use(GlobalExceptionFilter); // 7. Error handling
```

### Auth Middleware

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {

    constructor(
        private jwtService: JwtService,
        private logger: Logger
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            const decoded = this.jwtService.verify(token);
            request.user = decoded;
            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }

    private extractToken(request): string | null {
        const auth = request.headers.authorization;
        if (!auth) return null;

        const [scheme, token] = auth.split(' ');
        if (scheme !== 'Bearer') return null;

        return token;
    }
}
```

---

## Scaling

### Estratégias

```
┌─────────────────────────────────────────┐
│  Load Balancer (Nginx/HAProxy)          │
└────────┬────────────────┬───────────────┘
         │                │
         ▼                ▼
    ┌────────┐      ┌────────┐
    │Backend │      │Backend │    (múltiplas instâncias)
    │Port    │      │Port    │
    │3000    │      │3001    │
    └─┬──────┘      └──────┬─┘
      │                    │
      └────────┬───────────┘
               │
      ┌────────▼────────┐
      │  PostgreSQL     │    (conexão pool)
      │  Max Connections│
      │  25-50          │
      └─────────────────┘
```

### Cache com Redis

```typescript
// Caching de queries caras
async getScheduleRankings(scheduleId: string): Promise<Ranking[]> {
    const cacheKey = `rankings:${scheduleId}`;

    // Tenta cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Calcula
    const rankings = await this.calculateRankings(scheduleId);

    // Armazena 1 hora
    await this.redisService.set(cacheKey, JSON.stringify(rankings), 3600);

    return rankings;
}
```

### Rate Limiting

```typescript
@UseGuards(ThrottlerGuard)
@Controller('games')
export class GameController {

    @Post()
    @Throttle(10, 60)  // 10 requests per 60 seconds
    async create(@Body() dto: CreateGameDto) {
        return await this.gameService.createGame(dto);
    }
}
```

---

## Veja Também

- [README.md](./README.md) - Setup rápido
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Visão geral (3 camadas)
- [../API_REFERENCE.md](../API_REFERENCE.md) - Endpoints
- [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Schema
- [SERVICES.md](./SERVICES.md) - Serviços principais

---

**Última atualização:** Dezembro 2025
