import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './Game';
import { User } from './User';

export enum ConfirmationStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export enum PaymentStatus {
  PAID = 'paid',
  PENDING = 'pending',
}

@Entity('game_confirmations')
export class GameConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game, (game) => game.confirmations)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  user_id: string;

  @ManyToOne(() => User, (user) => user.confirmations)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: ConfirmationStatus,
    default: ConfirmationStatus.PENDING,
  })
  status: ConfirmationStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  payment_status: PaymentStatus;

  @Column({ default: false })
  is_casual_player: boolean;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
