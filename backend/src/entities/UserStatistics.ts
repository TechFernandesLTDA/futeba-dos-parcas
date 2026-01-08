import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { Schedule } from './Schedule';

@Entity('user_statistics')
@Unique(['user_id', 'schedule_id'])
export class UserStatistics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  schedule_id: string;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ default: 0 })
  total_games: number;

  @Column({ default: 0 })
  total_goals: number;

  @Column({ default: 0 })
  total_assists: number;

  @Column({ default: 0 })
  total_saves: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  draws: number;

  @Column({ default: 0 })
  losses: number;

  @Column({ default: 0 })
  points: number;

  @Column({ default: 0 })
  best_player_count: number;

  @Column({ default: 0 })
  worst_player_count: number;

  @Column({ default: 0 })
  best_goal_count: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  presence_rate: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
