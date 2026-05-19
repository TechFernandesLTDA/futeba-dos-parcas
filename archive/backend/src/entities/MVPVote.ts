import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './User';
import { Game } from './Game';

export enum VoteCategory {
  MVP = 'mvp', // Craque da Partida
  WORST = 'worst', // Bola Murcha
  BEST_GOALKEEPER = 'best_goalkeeper', // Melhor Goleiro
}

@Entity('mvp_votes')
@Unique(['game_id', 'voter_id', 'category'])
export class MVPVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  voter_id: string; // Quem votou

  @ManyToOne(() => User)
  @JoinColumn({ name: 'voter_id' })
  voter: User;

  @Column()
  voted_player_id: string; // Quem recebeu o voto

  @ManyToOne(() => User)
  @JoinColumn({ name: 'voted_player_id' })
  voted_player: User;

  @Column({
    type: 'enum',
    enum: VoteCategory,
  })
  category: VoteCategory;

  @CreateDateColumn()
  voted_at: Date;
}
