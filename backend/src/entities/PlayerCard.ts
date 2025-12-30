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

export enum CardRarity {
  COMUM = 'comum',
  INCOMUM = 'incomum',
  RARO = 'raro',
  EPICO = 'epico',
  LENDARIO = 'lendario',
}

@Entity('player_cards')
@Unique(['user_id', 'season'])
export class PlayerCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 'Temporada Atual' })
  season: string; // Ex: "2025-01", "Verão 2025"

  // Atributos estilo FIFA
  @Column({ default: 50 })
  attack_rating: number; // 0-99

  @Column({ default: 50 })
  defense_rating: number; // 0-99

  @Column({ default: 50 })
  physical_rating: number; // 0-99

  @Column({ default: 50 })
  technique_rating: number; // 0-99

  @Column({ default: 50 })
  overall_rating: number; // Média dos atributos

  @Column({
    type: 'enum',
    enum: CardRarity,
    default: CardRarity.COMUM,
  })
  rarity: CardRarity;

  @Column({ default: 1 })
  level: number; // Nível da carta (aumenta com jogos)

  @Column({ default: 0 })
  total_games: number; // Jogos que influenciaram esta carta

  @Column({ nullable: true })
  special_trait: string; // Ex: "Artilheiro", "Muralha", "Maestro"

  @Column({ nullable: true })
  card_image_url: string; // URL da imagem gerada

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
