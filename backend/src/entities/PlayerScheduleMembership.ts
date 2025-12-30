import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Schedule } from './Schedule';

export enum MembershipType {
  MONTHLY = 'monthly',
  CASUAL = 'casual',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}

@Entity('player_schedule_membership')
export class PlayerScheduleMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, (user) => user.memberships)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  schedule_id: string;

  @ManyToOne(() => Schedule, (schedule) => schedule.memberships)
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column({
    type: 'enum',
    enum: MembershipType,
    default: MembershipType.CASUAL,
  })
  membership_type: MembershipType;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.PENDING,
  })
  status: MembershipStatus;

  @Column({ type: 'date', nullable: true })
  started_at: Date;

  @Column({ type: 'date', nullable: true })
  ended_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
