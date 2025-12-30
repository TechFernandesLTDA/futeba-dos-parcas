import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Crowdfunding } from './Crowdfunding';

@Entity('crowdfunding_contributions')
export class CrowdfundingContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  crowdfunding_id: string;

  @ManyToOne(() => Crowdfunding)
  @JoinColumn({ name: 'crowdfunding_id' })
  crowdfunding: Crowdfunding;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: false })
  is_anonymous: boolean;

  @Column({ nullable: true })
  message: string; // Mensagem opcional do contribuidor

  @Column({ nullable: true })
  receipt_url: string; // Comprovante

  @CreateDateColumn()
  contributed_at: Date;
}
