import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Schedule } from './Schedule';
import { PlayerScheduleMembership } from './PlayerScheduleMembership';
import { GameConfirmation } from './GameConfirmation';
import { Notification } from './Notification';

export enum FieldType {
  SOCIETY = 'society',
  CAMPO = 'campo',
  FUTEBOL = 'futebol',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({
    type: 'enum',
    enum: FieldType,
    default: FieldType.SOCIETY,
  })
  preferred_field_type: FieldType;

  @Column({ default: true })
  is_searchable: boolean;

  @Column({ default: true })
  is_profile_public: boolean;

  @Column({ default: 'PLAYER' })
  role: string;

  @Column({ nullable: true })
  fcm_token: string;

  // Manual Ratings
  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  striker_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  mid_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  defender_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  gk_rating: number;

  // Gamification
  @Column({ default: 1 })
  level: number;

  @Column({ type: 'bigint', default: 0 })
  experience_points: number;

  @Column({ type: 'jsonb', default: [] })
  milestones_achieved: string[];

  // Auto Ratings
  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  auto_striker_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  auto_mid_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  auto_defender_rating: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  auto_gk_rating: number;

  @Column({ default: 0 })
  auto_rating_samples: number;

  @Column({ nullable: true })
  preferred_position: string;

  // League System
  @Column({ default: 'BRONZE' })
  division: string;

  @Column({ default: 0 })
  promotion_progress: number;

  @Column({ default: 0 })
  relegation_progress: number;

  @Column({ default: 0 })
  protection_games: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  league_rating: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Schedule, (schedule) => schedule.owner)
  owned_schedules: Schedule[];

  @OneToMany(() => PlayerScheduleMembership, (membership) => membership.user)
  memberships: PlayerScheduleMembership[];

  @OneToMany(() => GameConfirmation, (confirmation) => confirmation.user)
  confirmations: GameConfirmation[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  // Method to return user without sensitive data
  toPublic() {
    const { password_hash, fcm_token, ...publicData } = this;
    return publicData;
  }
}
