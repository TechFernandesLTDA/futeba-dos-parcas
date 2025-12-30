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

  @Column({ nullable: true })
  fcm_token: string;

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
