import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './Game';
import { User } from './User';
import { Team } from './Team';

@Entity('game_stats')
export class GameStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game, (game) => game.stats)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  team_id: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ default: 0 })
  goals: number;

  @Column({ default: 0 })
  saves: number;

  @Column({ default: false })
  is_best_player: boolean;

  @Column({ default: false })
  is_worst_player: boolean;

  @Column({ default: false })
  best_goal: boolean;

  @CreateDateColumn()
  created_at: Date;
}
