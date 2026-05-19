import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Game } from './Game';
import { Schedule } from './Schedule';

export enum PaymentType {
  MONTHLY = 'monthly', // Mensalista
  DAILY = 'daily', // Avulso/Diária
  EXTRA = 'extra', // Taxas extras
}

export enum PaymentMethod {
  PIX = 'pix',
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  game_id: string;

  @ManyToOne(() => Game, { nullable: true })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column({ nullable: true })
  schedule_id: string;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type: PaymentType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  payment_method: PaymentMethod;

  @Column({ type: 'date' })
  due_date: Date; // Data de vencimento

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @Column({ nullable: true })
  pix_key: string; // Chave PIX para pagamento

  @Column({ nullable: true })
  pix_qrcode: string; // QR Code PIX

  @Column({ nullable: true })
  pix_txid: string; // ID da transação PIX

  @Column({ nullable: true })
  receipt_url: string; // URL do comprovante

  @Column({ nullable: true })
  notes: string; // Observações

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
