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
import { WeeklyChallenge } from './WeeklyChallenge';

@Entity('user_challenge_progress')
@Unique(['user_id', 'challenge_id'])
export class UserChallengeProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  challenge_id: string;

  @ManyToOne(() => WeeklyChallenge)
  @JoinColumn({ name: 'challenge_id' })
  challenge: WeeklyChallenge;

  @Column({ default: 0 })
  current_progress: number; // Progresso atual

  @Column({ default: false })
  is_completed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
