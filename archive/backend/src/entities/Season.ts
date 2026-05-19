import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SeasonParticipation } from './SeasonParticipation';

export enum LeagueDivision {
  BRONZE = 'bronze',
  PRATA = 'prata',
  OURO = 'ouro',
  DIAMANTE = 'diamante',
}

@Entity('seasons')
export class Season {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // Ex: "Janeiro 2025", "Temporada Verão 2025"

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  schedule_id: string; // Opcional: vincular a um horário específico

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => SeasonParticipation, (participation) => participation.season)
  participations: SeasonParticipation[];
}
