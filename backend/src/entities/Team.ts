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
import { Game } from './Game';
import { TeamPlayer } from './TeamPlayer';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game, (game) => game.teams)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  name: string;

  @Column({ nullable: true })
  color: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => TeamPlayer, (teamPlayer) => teamPlayer.team)
  players: TeamPlayer[];
}
