import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './Game';
import { User } from './User';

@Entity('tactical_boards')
export class TacticalBoard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game_id: string;

  @ManyToOne(() => Game)
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Column()
  creator_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column()
  formation_name: string; // Ex: "4-4-2", "3-5-2"

  @Column({ type: 'json' })
  player_positions: object; // JSON com posições dos jogadores no campo
  // Exemplo: { "player_id": { x: 50, y: 30, role: "ATK" } }

  @Column({ type: 'text', nullable: true })
  notes: string; // Observações táticas

  @Column({ nullable: true })
  image_url: string; // Screenshot/imagem da prancheta

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
