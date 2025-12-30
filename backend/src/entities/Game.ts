import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Schedule } from './Schedule';
import { GameConfirmation } from './GameConfirmation';
import { Team } from './Team';
import { GameStats } from './GameStats';
import { GameInvite } from './GameInvite';

export enum GameStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schedule_id: string;

  @ManyToOne(() => Schedule, (schedule) => schedule.games)
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  time: string;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.SCHEDULED,
  })
  status: GameStatus;

  @Column({ nullable: true })
  max_players: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  daily_price: number;

  @Column({ type: 'timestamp', nullable: true })
  confirmation_closes_at: Date;

  @Column({ nullable: true })
  number_of_teams: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => GameConfirmation, (confirmation) => confirmation.game)
  confirmations: GameConfirmation[];

  @OneToMany(() => Team, (team) => team.game)
  teams: Team[];

  @OneToMany(() => GameStats, (stats) => stats.game)
  stats: GameStats[];

  @OneToMany(() => GameInvite, (invite) => invite.game)
  invites: GameInvite[];
}
