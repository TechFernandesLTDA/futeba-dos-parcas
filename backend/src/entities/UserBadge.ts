import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Badge } from './Badge';

@Entity('user_badges')
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  badge_id: string;

  @ManyToOne(() => Badge)
  @JoinColumn({ name: 'badge_id' })
  badge: Badge;

  @Column({ default: 1 })
  count: number; // Quantas vezes conquistou (para badges repetíveis como hat-trick)

  @CreateDateColumn()
  unlocked_at: Date; // Data do primeiro desbloqueio

  @Column({ type: 'timestamp', nullable: true })
  last_earned_at: Date; // Data da última vez que conquistou
}
