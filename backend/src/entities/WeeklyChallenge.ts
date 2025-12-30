import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserChallengeProgress } from './UserChallengeProgress';

export enum ChallengeType {
  SCORE_GOALS = 'score_goals', // Fazer X gols
  WIN_GAMES = 'win_games', // Ganhar X jogos
  ASSISTS = 'assists', // Dar X assistências
  CLEAN_SHEETS = 'clean_sheets', // X jogos sem levar gol
  PLAY_GAMES = 'play_games', // Jogar X jogos
  INVITE_PLAYERS = 'invite_players', // Convidar X jogadores
}

@Entity('weekly_challenges')
export class WeeklyChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // Ex: "Artilheiro da Semana"

  @Column()
  description: string; // Ex: "Faça 3 gols esta semana"

  @Column({
    type: 'enum',
    enum: ChallengeType,
  })
  type: ChallengeType;

  @Column()
  target_value: number; // Valor alvo (ex: 3 gols)

  @Column({ default: 100 })
  xp_reward: number; // XP ao completar

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  schedule_id: string; // Opcional: desafio específico de um horário

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserChallengeProgress, (progress) => progress.challenge)
  user_progress: UserChallengeProgress[];
}
