import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('head_to_head')
export class HeadToHead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  player1_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player1_id' })
  player1: User;

  @Column()
  player2_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player2_id' })
  player2: User;

  @Column({ default: 0 })
  player1_wins: number; // Vitórias do jogador 1

  @Column({ default: 0 })
  player2_wins: number; // Vitórias do jogador 2

  @Column({ default: 0 })
  draws: number; // Empates

  @Column({ default: 0 })
  total_games: number; // Total de jogos entre eles

  @Column({ default: 0 })
  player1_goals: number; // Gols marcados por player1 quando jogaram juntos/contra

  @Column({ default: 0 })
  player2_goals: number; // Gols marcados por player2

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
