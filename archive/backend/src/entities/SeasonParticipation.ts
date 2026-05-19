import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { Season, LeagueDivision } from './Season';

@Entity('season_participations')
@Unique(['user_id', 'season_id'])
export class SeasonParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  season_id: string;

  @ManyToOne(() => Season)
  @JoinColumn({ name: 'season_id' })
  season: Season;

  @Column({
    type: 'enum',
    enum: LeagueDivision,
    default: LeagueDivision.BRONZE,
  })
  division: LeagueDivision;

  @Column({ default: 0 })
  points: number; // Pontos acumulados na temporada

  @Column({ default: 0 })
  games_played: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  draws: number;

  @Column({ default: 0 })
  losses: number;

  @Column({ default: 0 })
  goals_scored: number;

  @Column({ default: 0 })
  goals_conceded: number;

  @Column({ default: 0 })
  mvp_count: number; // Quantidade de vezes eleito MVP

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
