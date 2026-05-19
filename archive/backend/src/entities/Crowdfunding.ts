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
import { User } from './User';
import { Schedule } from './Schedule';
import { CrowdfundingContribution } from './CrowdfundingContribution';

export enum CrowdfundingType {
  BBQ = 'bbq', // Churrasco
  UNIFORM = 'uniform', // Uniforme
  EQUIPMENT = 'equipment', // Equipamento
  PARTY = 'party', // Festa/Confraternização
  OTHER = 'other', // Outros
}

export enum CrowdfundingStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('crowdfundings')
export class Crowdfunding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizer_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'organizer_id' })
  organizer: User;

  @Column({ nullable: true })
  schedule_id: string;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @Column()
  title: string; // Ex: "Churrasco do Final de Ano"

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: CrowdfundingType,
  })
  type: CrowdfundingType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  target_amount: number; // Valor alvo

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  current_amount: number; // Valor arrecadado

  @Column({ type: 'date' })
  deadline: Date;

  @Column({
    type: 'enum',
    enum: CrowdfundingStatus,
    default: CrowdfundingStatus.ACTIVE,
  })
  status: CrowdfundingStatus;

  @Column({ nullable: true })
  pix_key: string; // Chave PIX para recebimento

  @Column({ nullable: true })
  image_url: string; // Imagem da vaquinha

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CrowdfundingContribution, (contribution) => contribution.crowdfunding)
  contributions: CrowdfundingContribution[];
}
