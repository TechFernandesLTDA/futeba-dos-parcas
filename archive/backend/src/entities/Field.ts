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
import { Location } from './Location';
import { Schedule } from './Schedule';
import { FieldType } from './User';

@Entity('fields')
export class Field {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  location_id: string;

  @ManyToOne(() => Location, (location) => location.fields)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: FieldType,
    default: FieldType.SOCIETY,
  })
  type: FieldType;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  photo_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Schedule, (schedule) => schedule.field)
  schedules: Schedule[];
}
