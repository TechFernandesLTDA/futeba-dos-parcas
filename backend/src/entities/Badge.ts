import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserBadge } from './UserBadge';

export enum BadgeType {
  // Conquistas de Performance
  HAT_TRICK = 'hat_trick', // 3 gols em um jogo
  PAREDAO = 'paredao', // Clean sheet como goleiro
  ARTILHEIRO_MES = 'artilheiro_mes', // Mais gols no mês

  // Conquistas de Presença
  FOMINHA = 'fominha', // 100% presença no mês
  STREAK_7 = 'streak_7', // 7 jogos seguidos
  STREAK_30 = 'streak_30', // 30 jogos seguidos

  // Conquistas Sociais
  ORGANIZADOR_MASTER = 'organizador_master', // Organizou 50+ jogos
  INFLUENCER = 'influencer', // Convidou 20+ jogadores

  // Conquistas Raras
  LENDA = 'lenda', // 500+ jogos
  FAIXA_PRETA = 'faixa_preta', // MVP 100+ vezes
  MITO = 'mito', // Artilheiro por 3 meses seguidos
}

@Entity('badges')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: BadgeType,
    unique: true,
  })
  type: BadgeType;

  @Column()
  name: string; // Nome exibido (PT-BR)

  @Column()
  description: string; // Descrição da conquista

  @Column()
  icon_url: string; // URL do ícone/imagem

  @Column({ default: 0 })
  xp_reward: number; // XP ganho ao conquistar

  @Column({
    type: 'enum',
    enum: ['comum', 'raro', 'epico', 'lendario'],
    default: 'comum',
  })
  rarity: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => UserBadge, (userBadge) => userBadge.badge)
  user_badges: UserBadge[];
}
