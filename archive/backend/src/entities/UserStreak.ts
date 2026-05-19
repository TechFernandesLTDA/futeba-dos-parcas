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

@Entity('user_streaks')
@Unique(['user_id', 'schedule_id'])
export class UserStreak {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  schedule_id: string; // null = streak geral

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({ default: 0 })
  current_streak: number; // Streak atual

  @Column({ default: 0 })
  longest_streak: number; // Maior streak já alcançado

  @Column({ type: 'date', nullable: true })
  last_game_date: Date; // Data do último jogo confirmado

  @Column({ type: 'date', nullable: true })
  streak_started_at: Date; // Quando começou o streak atual

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
