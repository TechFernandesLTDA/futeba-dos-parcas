# 🎛️ Backend Controllers - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Padrão de Controllers](#padrão-de-controllers)
- [GameController](#gamecontroller)
- [AuthController](#authcontroller)
- [UserController](#usercontroller)
- [StatisticsController](#statisticscontroller)
- [Error Handling](#error-handling)

---

## Visão Geral

Controllers gerenciam requisições HTTP. Cada controller corresponde a um recurso (games, users, etc).

```
HTTP Request
    ↓
Route → Controller
              ↓
          Validar DTO
              ↓
          Chamar Service
              ↓
          Formatar Response
              ↓
        HTTP Response
```

**Responsabilidades do Controller:**
- ✅ Receber requisições HTTP
- ✅ Validar input (DTO)
- ✅ Extrair user do token JWT
- ✅ Chamar service
- ✅ Retornar resposta formatada
- ❌ Lógica de negócio (= Service)
- ❌ Acesso a banco (= Repository)

---

## Padrão de Controllers

### Estrutura Base

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { MyService } from '../services/my.service';
import { CreateMyDto, UpdateMyDto } from '../dto/my.dto';

@Controller('my-resource')
@UseGuards(JwtAuthGuard)  // Proteger todas as rotas
export class MyController {

    constructor(private myService: MyService) {}

    // GET /my-resource
    @Get()
    async getAll(
        @Query('limit') limit: number = 20,
        @Query('offset') offset: number = 0
    ) {
        const { data, total } = await this.myService.getAll(limit, offset);
        return { success: true, data, total };
    }

    // GET /my-resource/:id
    @Get(':id')
    async getById(@Param('id') id: string) {
        const data = await this.myService.getById(id);
        return { success: true, data };
    }

    // POST /my-resource
    @Post()
    async create(
        @Body() dto: CreateMyDto,
        @Request() req
    ) {
        const data = await this.myService.create(dto, req.user.id);
        return { success: true, data, statusCode: 201 };
    }

    // PUT /my-resource/:id
    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateMyDto,
        @Request() req
    ) {
        const data = await this.myService.update(id, dto, req.user.id);
        return { success: true, data };
    }

    // DELETE /my-resource/:id
    @Delete(':id')
    async delete(
        @Param('id') id: string,
        @Request() req
    ) {
        await this.myService.delete(id, req.user.id);
        return { success: true, message: 'Deleted successfully' };
    }
}
```

### Response Padrão

```typescript
// Sucesso
{
    "success": true,
    "data": { /* recurso ou lista */ },
    "total": 25,  // Se houver paginação
    "statusCode": 200
}

// Erro
{
    "success": false,
    "error": "GAME_NOT_FOUND",
    "message": "Game xyz not found",
    "statusCode": 404
}
```

---

## GameController

Gerencia games (partidas de futebol).

```typescript
@Controller('games')
@UseGuards(JwtAuthGuard)
export class GameController {

    constructor(
        private gameService: GameService,
        private teamBalancerService: TeamBalancerService
    ) {}

    // ====== LISTAR JOGOS ======
    @Get('upcoming')
    async getUpcomingGames(
        @Query('days') days: number = 7,
        @Query('location') locationId?: string,
        @Query('status') status?: 'SCHEDULED' | 'CONFIRMED',
        @Query('limit') limit: number = 20,
        @Query('offset') offset: number = 0
    ) {
        const { games, total } = await this.gameService.getUpcomingGames(
            days,
            locationId,
            status,
            limit,
            offset
        );

        return {
            success: true,
            data: games,
            total,
            statusCode: 200
        };
    }

    // ====== GET DETALHES ======
    @Get(':id')
    async getGameById(@Param('id') gameId: string) {
        const game = await this.gameService.getGameById(gameId);
        return { success: true, data: game };
    }

    // ====== CRIAR JOGO ======
    @Post()
    async createGame(
        @Body() dto: CreateGameDto,
        @Request() req
    ) {
        const game = await this.gameService.createGame(dto, req.user.id);
        return { success: true, data: game, statusCode: 201 };
    }

    /**
     * Request:
     * {
     *   "date": "2024-01-15",
     *   "time": "19:00",
     *   "fieldId": "field-uuid",
     *   "maxPlayers": 12,
     *   "dailyPrice": 150.00
     * }
     */

    // ====== CONFIRMAR PRESENÇA ======
    @Post(':id/confirm')
    async confirmPresence(
        @Param('id') gameId: string,
        @Body() { position }: ConfirmPresenceDto,
        @Request() req
    ) {
        const confirmation = await this.gameService.confirmPresence(
            gameId,
            req.user.id,
            position
        );

        return { success: true, data: confirmation };
    }

    /**
     * Request: { "position": "FIELD" | "GOALKEEPER" }
     * Response: { userId, gameId, position, confirmedAt }
     */

    // ====== CANCELAR PRESENÇA ======
    @Delete(':id/confirm')
    async cancelPresence(
        @Param('id') gameId: string,
        @Request() req
    ) {
        await this.gameService.cancelPresence(gameId, req.user.id);
        return { success: true, message: 'Presença cancelada' };
    }

    // ====== FECHAR CONFIRMAÇÕES ======
    @Post(':id/close-confirmations')
    async closeConfirmations(
        @Param('id') gameId: string,
        @Request() req
    ) {
        const result = await this.gameService.closeConfirmations(
            gameId,
            req.user.id
        );

        return { success: true, data: result };
    }

    /**
     * Requer ser o criador do jogo
     * Response: { total: 11, FIELD: 10, GOALKEEPER: 1 }
     */

    // ====== GERAR TIMES ======
    @Post(':id/teams')
    async generateTeams(
        @Param('id') gameId: string,
        @Body() { numberOfTeams, balanceTeams }: GenerateTeamsDto,
        @Request() req
    ) {
        const teams = await this.teamBalancerService.generateTeams(
            gameId,
            numberOfTeams,
            balanceTeams
        );

        return { success: true, data: teams };
    }

    /**
     * Request: { "numberOfTeams": 2, "balanceTeams": true }
     * Response: Array de teams com players
     */

    // ====== REGISTRAR ESTATÍSTICAS ======
    @Post(':id/stats')
    async recordStats(
        @Param('id') gameId: string,
        @Body() dto: RecordStatsDto,
        @Request() req
    ) {
        const xpAwarded = await this.gameService.finalizeGame(
            gameId,
            dto.stats,
            dto.winningTeamId
        );

        return { success: true, data: { xpAwarded } };
    }

    /**
     * Request: {
     *   "stats": [
     *     { "userId": "uuid", "goals": 2, "assists": 1, "saves": 0, "isMvp": false },
     *     { "userId": "uuid", "goals": 0, "assists": 0, "saves": 5, "isMvp": true }
     *   ],
     *   "winningTeamId": "team-uuid"
     * }
     */
}
```

---

## AuthController

Gerencia autenticação e autorização.

```typescript
@Controller('auth')
export class AuthController {

    constructor(private authService: AuthService) {}

    // ====== REGISTRO ======
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        const result = await this.authService.register(dto);
        return {
            success: true,
            message: 'Usuário criado com sucesso',
            data: { userId: result.id }
        };
    }

    /**
     * Request: {
     *   "name": "João Silva",
     *   "email": "joao@example.com",
     *   "password": "senhaSegura123",
     *   "phone": "11987654321",
     *   "preferredFieldType": "SOCIETY"
     * }
     */

    // ====== LOGIN ======
    @Post('login')
    async login(@Body() { email, password }: LoginDto) {
        const { token, user } = await this.authService.login(email, password);

        return {
            success: true,
            data: {
                token,  // JWT
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    level: user.level,
                    xp: user.xp
                }
            }
        };
    }

    /**
     * Request: { "email": "joao@example.com", "password": "..." }
     * Response: { token: "jwt...", user: {...} }
     */

    // ====== REFRESH TOKEN ======
    @Post('refresh')
    async refresh(@Body() { token }: { token: string }) {
        const newToken = await this.authService.refreshToken(token);

        return {
            success: true,
            data: { token: newToken }
        };
    }

    // ====== LOGOUT ======
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    async logout(@Request() req) {
        // Pode fazer cleanup (revogar token, etc)
        return { success: true, message: 'Logout realizado' };
    }
}
```

---

## UserController

Gerencia perfis de usuários.

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {

    constructor(private userService: UserService) {}

    // ====== MEU PERFIL ======
    @Get('me')
    async getMyProfile(@Request() req) {
        const user = await this.userService.getUserById(req.user.id);

        return {
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                level: user.level,
                xp: user.xp,
                photoUrl: user.photoUrl,
                preferredFieldType: user.preferredFieldType,
                isSearchable: user.isSearchable,
                createdAt: user.createdAt
            }
        };
    }

    // ====== ATUALIZAR PERFIL ======
    @Put('me')
    async updateMyProfile(
        @Body() dto: UpdateUserDto,
        @Request() req
    ) {
        const user = await this.userService.updateUser(req.user.id, dto);

        return { success: true, message: 'Perfil atualizado', data: user };
    }

    /**
     * Request: {
     *   "name": "João Silva Santos",
     *   "phone": "11999999999",
     *   "photoUrl": "https://...",
     *   "preferredFieldType": "SOCIETY",
     *   "isSearchable": true
     * }
     */

    // ====== BUSCAR JOGADORES ======
    @Get('search')
    async searchPlayers(
        @Query('q') query: string,
        @Query('limit') limit: number = 10,
        @Query('offset') offset: number = 0
    ) {
        const { users, total } = await this.userService.searchPlayers(
            query,
            limit,
            offset
        );

        return {
            success: true,
            data: users,
            total
        };
    }

    /**
     * Query: ?q=joão&limit=10&offset=0
     * Response: Array de usuários com stats básicas
     */

    // ====== GET PERFIL DE OUTRO USUÁRIO ======
    @Get(':id')
    async getUserProfile(@Param('id') userId: string) {
        const user = await this.userService.getUserById(userId);

        return {
            success: true,
            data: {
                id: user.id,
                name: user.name,
                level: user.level,
                xp: user.xp,
                photoUrl: user.photoUrl,
                stats: user.stats
            }
        };
    }

    // ====== DELETAR CONTA ======
    @Delete('me')
    async deleteAccount(
        @Request() req,
        @Body() { password }: { password: string }
    ) {
        await this.userService.deleteAccount(req.user.id, password);

        return { success: true, message: 'Conta deletada permanentemente' };
    }
}
```

---

## StatisticsController

Gerencia estatísticas de jogadores.

```typescript
@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {

    constructor(private statisticsService: StatisticsService) {}

    // ====== MINHAS ESTATÍSTICAS ======
    @Get('me')
    async getMyStatistics(@Request() req) {
        const stats = await this.statisticsService.getUserStats(req.user.id);

        return {
            success: true,
            data: {
                userId: req.user.id,
                level: stats.level,
                xp: stats.xp,
                nextLevelXp: stats.nextLevelXp,
                stats: {
                    totalGames: stats.totalGames,
                    totalGoals: stats.totalGoals,
                    totalAssists: stats.totalAssists,
                    totalSaves: stats.totalSaves,
                    bestPlayerCount: stats.bestPlayerCount,
                    presenceRate: stats.presenceRate
                },
                badges: stats.badges,
                schedules: stats.schedules
            }
        };
    }

    // ====== STATS DE OUTRO USUÁRIO ======
    @Get('user/:userId')
    async getUserStatistics(@Param('userId') userId: string) {
        const stats = await this.statisticsService.getUserStats(userId);

        return {
            success: true,
            data: stats
        };
    }

    // ====== RANKING DO HORÁRIO ======
    @Get('schedule/:scheduleId/rankings')
    async getScheduleRankings(
        @Param('scheduleId') scheduleId: string,
        @Query('limit') limit: number = 10,
        @Query('offset') offset: number = 0
    ) {
        const { rankings, total } = await this.statisticsService
            .getScheduleRankings(scheduleId, limit, offset);

        return {
            success: true,
            data: rankings,
            total
        };
    }

    /**
     * Response: [
     *   {
     *     "position": 1,
     *     "userId": "uuid",
     *     "name": "João Silva",
     *     "level": 8,
     *     "xp": 5200,
     *     "games": 18,
     *     "goals": 25,
     *     "presenceRate": 1.0
     *   }
     * ]
     */

    // ====== STATS GLOBAL ======
    @Get('global')
    async getGlobalRankings(
        @Query('limit') limit: number = 10,
        @Query('offset') offset: number = 0
    ) {
        const { rankings, total } = await this.statisticsService
            .getGlobalRankings(limit, offset);

        return {
            success: true,
            data: rankings,
            total
        };
    }
}
```

---

## Error Handling

### Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {

    constructor(private logger: Logger) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse();
        const request = host.switchToHttp().getRequest();

        let statusCode = 500;
        let message = 'Internal server error';
        let error = 'INTERNAL_SERVER_ERROR';

        // Exceções conhecidas
        if (exception instanceof BadRequestException) {
            statusCode = 400;
            message = exception.getResponse()['message'];
            error = 'BAD_REQUEST';
        } else if (exception instanceof UnauthorizedException) {
            statusCode = 401;
            message = 'Unauthorized';
            error = 'UNAUTHORIZED';
        } else if (exception instanceof ForbiddenException) {
            statusCode = 403;
            message = 'Forbidden';
            error = 'FORBIDDEN';
        } else if (exception instanceof NotFoundException) {
            statusCode = 404;
            message = exception.message;
            error = 'NOT_FOUND';
        } else if (exception instanceof ConflictException) {
            statusCode = 409;
            message = exception.message;
            error = 'CONFLICT';
        }

        // Log
        this.logger.error(
            `${statusCode} ${error} - ${message}`,
            exception instanceof Error ? exception.stack : '',
            `${request.method} ${request.url}`
        );

        response.status(statusCode).json({
            success: false,
            statusCode,
            error,
            message,
            timestamp: new Date().toISOString()
        });
    }
}
```

### DTOs com Validação

```typescript
// CreateGameDto
export class CreateGameDto {
    @IsDateString()
    @IsNotEmpty()
    @IsISO8601()
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

// Validação automática
@Post()
async create(@Body() dto: CreateGameDto) {
    // Se inválido, NestJS retorna 400 automaticamente
    return this.gameService.createGame(dto);
}
```

---

## Veja Também

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Padrão Controller-Service-Repository
- [SERVICES.md](./SERVICES.md) - Lógica que controllers chamam
- [../API_REFERENCE.md](../API_REFERENCE.md) - Endpoints documentados
- [../DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) - Padrões de código

---

**Última atualização:** Dezembro 2025
