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

export enum ScoreEventType {
  GOAL = 'goal',
  OWN_GOAL = 'own_goal',
  ASSIST = 'assist',
  SAVE = 'save',
  YELLOW_CARD = 'yellow_card',
  RED_CARD = 'red_card',
}

@Entity('live_scores')
export class LiveScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  player_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player_id' })
  player: User;

  @Column({ nullable: true })
  team_id: string;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({
    type: 'enum',
    enum: ScoreEventType,
  })
  event_type: ScoreEventType;

  @Column({ nullable: true })
  minute: number; // Minuto do evento (opcional)

  @Column({ nullable: true })
  assisted_by_id: string; // ID de quem deu assistência

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assisted_by_id' })
  assisted_by: User;

  @Column()
  reporter_id: string; // Quem reportou o evento

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @CreateDateColumn()
  created_at: Date;
}
