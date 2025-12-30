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
import { Field } from './Field';
import { User } from './User';
import { Game } from './Game';
import { PlayerScheduleMembership } from './PlayerScheduleMembership';

export enum RecurrenceType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom',
}

export interface RecurrenceConfig {
  days?: number[]; // 0-6 (domingo a sábado) para weekly
  interval?: number; // para daily (ex: a cada 2 dias)
  specific_dates?: string[]; // para custom
}

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  field_id: string;

  @ManyToOne(() => Field, (field) => field.schedules)
  @JoinColumn({ name: 'field_id' })
  field: Field;

  @Column()
  owner_id: string;

  @ManyToOne(() => User, (user) => user.owned_schedules)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: RecurrenceType,
  })
  recurrence_type: RecurrenceType;

  @Column({ type: 'jsonb' })
  recurrence_config: RecurrenceConfig;

  @Column({ type: 'time' })
  time: string;

  @Column()
  duration: number; // minutos

  @Column({ default: false })
  is_public: boolean;

  @Column({ nullable: true })
  max_players: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  daily_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monthly_price: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Game, (game) => game.schedule)
  games: Game[];

  @OneToMany(() => PlayerScheduleMembership, (membership) => membership.schedule)
  memberships: PlayerScheduleMembership[];
}
