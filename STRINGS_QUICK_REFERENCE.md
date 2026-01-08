# Referência Rápida: Strings Centralizadas

## Índice de Strings por Categoria

### 🎮 Game Module (108 strings)

#### Status
| String ID | Valor |
|-----------|-------|
| `game_status_scheduled` | SCHEDULED |
| `game_status_confirmed` | CONFIRMED |
| `game_status_live` | LIVE |
| `game_status_finished` | FINISHED |
| `game_status_open` | OPEN |
| `game_status_pending` | PENDING |
| `game_status_paid` | PAID |
| `game_status_cancelled` | CANCELLED |

#### Actions
| String ID | Valor |
|-----------|-------|
| `game_action_start` | Iniciar Jogo |
| `game_action_finish` | Finalizar Jogo |
| `game_action_balance_teams` | Equilibrar por habilidade? |
| `game_action_balance_teams_short` | Gerar Times |
| `game_action_clear_teams` | Limpar Times |
| `game_action_move_player` | Mover para: |
| `game_action_generate_card` | Gerar Card do Jogo |
| `game_action_choose_mvp` | Escolher MVP |
| `game_action_open_list` | Lista Aberta |
| `game_action_closed_list` | Lista Fechada |
| `game_action_attendance_list` | Lista de Presença |

#### Events
| String ID | Valor |
|-----------|-------|
| `game_event_goal` | Gol |
| `game_event_goal_type` | GOAL |
| `game_event_save` | Defesa |
| `game_event_yellow_card` | Amarelo |
| `game_event_yellow_card_type` | YELLOW_CARD |
| `game_event_red_card` | Vermelho |
| `game_event_red_card_type` | RED_CARD |
| `game_event_assist` | Assistência |

#### Teams
| String ID | Valor |
|-----------|-------|
| `team_label_a` | Time A |
| `team_label_b` | Time B |
| `team_label_one` | Time 1 |
| `team_label_two` | Time 2 |
| `team_vs` | vs |
| `team_score_display` | Gols: ${team.score} |

#### Confirmation
| String ID | Valor |
|-----------|-------|
| `game_confirm_presence` | Confirmar Presença |
| `game_cancel_presence` | Cancelar Presença |
| `game_cancel_confirmation` | Cancelar Confirmação |
| `game_accept_invite` | Aceitar Convite |
| `game_decline_invite` | Recusar |
| `game_accept` | Aceitar |

#### Position Selection
| String ID | Valor |
|-----------|-------|
| `position_select_title` | Escolha sua posição |
| `position_goalkeeper` | Goleiro |
| `position_line` | Linha |
| `position_defend_goal` | Defender o gol da equipe |
| `position_play_line` | Jogar na linha (ataque/defesa) |
| `position_goalkeepers_count` | Goleiros: 0/2 |
| `position_line_count` | Linha: 0/12 |

#### Scheduling
| String ID | Valor |
|-----------|-------|
| `game_schedule_frequency_weekly` | Semanal |
| `game_schedule_frequency_biweekly` | Quinzenal |
| `game_schedule_frequency_monthly` | Mensal |
| `game_schedule_auto` | Agendamento Automático |
| `game_schedule_template_description` | O sistema agendará o próximo jogo automaticamente na Central de Recorrências. |
| `game_schedule_next_planned` | Proximo jogo agendado: ${event.nextDate} |
| `game_schedule_conflict` | Conflito! Nao foi possivel agendar em ${event.date}. |
| `game_schedule_error` | Erro no agendamento: ${event.message} |
| `game_cancelled_success` | Jogo cancelado com sucesso |
| `game_field_type_society` | Society |
| `game_field_type_futsal` | Futsal |
| `game_field_type_field` | Campo |

#### Details
| String ID | Valor |
|-----------|-------|
| `game_detail_header` | Detalhes do Jogo |
| `game_detail_mvp` | MVP da Partida |
| `game_detail_performance` | SEU DESEMPENHO |
| `game_detail_management` | Administração |
| `game_detail_event_timeline` | Linha do Tempo |
| `game_location_format` | Jogo em ${state.game.locationName} |
| `game_field_format` | Quadra: ${game.fieldName} |

---

### 💰 Cashbox Module (26 strings)

| String ID | Valor |
|-----------|-------|
| `cashbox_title` | Caixa do Grupo |
| `cashbox_add_income` | Adicionar Receita |
| `cashbox_add_expense` | Adicionar Despesa |
| `cashbox_current_balance` | Saldo Atual |
| `cashbox_income_header` | Receitas |
| `cashbox_expense_header` | Despesas |
| `cashbox_filter` | Filtrar |
| `cashbox_all` | Todos |
| `cashbox_report` | Relatórios |
| `cashbox_no_entries` | Não há movimentações registradas no caixa |
| `cashbox_entry_details` | Detalhes da Entrada |
| `cashbox_void_entry` | Estornar Entrada |
| `cashbox_void_confirm` | Deseja realmente estornar esta entrada? Esta ação não pode ser desfeita. |
| `cashbox_void_button` | Estornar |
| `cashbox_status_voided` | ESTORNADO |
| `cashbox_status_voided_cancelled` | ESTORNADO/CANCELADO |
| `cashbox_recalculate` | Recalcular Saldo |
| `cashbox_recalculate_confirm` | Isso irá recalcular o saldo com base em todas as entradas e saídas. Continuar? |
| `cashbox_first_entry_hint` | Adicione sua primeira entrada ou saída para começar |
| `cashbox_category` | Categoria |
| `cashbox_player` | Jogador |
| `cashbox_value` | Valor |
| `cashbox_description` | Descrição |
| `cashbox_status` | Status |
| `cashbox_totals_by_category` | Totais por Categoria |
| `cashbox_totals_by_player` | Totais por Jogador |
| `cashbox_no_data` | Nenhum dado encontrado. |

---

### 🏆 League Module (24 strings)

| String ID | Valor |
|-----------|-------|
| `league_title` | Sistema de Ligas |
| `league_my_position` | Minha Posição |
| `league_divisions` | Divisões |
| `league_classification` | Classificação |
| `league_active` | Ativa |
| `league_no_season` | Nenhuma temporada ativa no momento. |
| `league_season_message` | Aguarde o início da próxima temporada para subir no ranking! |
| `league_no_players` | Nenhum jogador nesta divisão |
| `league_period` | Período |
| `league_points` | Pontos |
| `league_games_played` | Jogos |
| `league_victories` | Vitórias |
| `league_mvp_count` | MVPs |
| `league_goals` | Gols |
| `league_assists` | Assists |
| `league_division_gold` | OURO |
| `league_division_silver` | PRATA |
| `league_division_bronze` | BRONZE |
| `league_division_diamond` | DIAMANTE |
| `league_rating_format` | Rating: ${ |
| `league_rating_description` | Rating calculado baseado em: |
| `league_rules_show` | Como funciona? |
| `league_rules_hide` | Ocultar regras |
| `league_ranking_title` | Ranking |
| `league_next_threshold` | Prox: ${nextThreshold.toInt()} |
| `league_elite` | Elite do fut |
| `league_experienced` | Jogadores experientes |
| `league_evolving` | Em evolução |
| `league_beginners` | Iniciantes |

---

### 📍 Location Module (39 strings)

#### Basic Info
| String ID | Valor |
|-----------|-------|
| `location_add_title` | Adicionar Quadra |
| `location_edit_title` | Editar Quadra |
| `location_basic_info` | Informações Básicas |
| `location_details` | Detalhes do Local |
| `location_no_registered` | Nenhum local cadastrado |

#### Address Fields
| String ID | Valor |
|-----------|-------|
| `location_country` | Brasil |
| `location_state` | Estado |
| `location_city` | Cidade |
| `location_zipcode` | CEP |
| `location_address` | Endereço |
| `location_complement` | Complemento |
| `location_neighborhood` | Bairro |
| `location_description` | Descrição |

#### Hours & Geo
| String ID | Valor |
|-----------|-------|
| `location_opening_time` | Abre |
| `location_closing_time` | Fecha |
| `location_hours_header` | Funcionamento |
| `location_geo_label` | Geolocalização |
| `location_geo_update` | Atualizar Coordenadas |
| `location_geo_search` | Buscar |
| `location_geo_format` | Lat: $latitude / Lng: $longitude |

#### Amenities
| String ID | Valor |
|-----------|-------|
| `location_amenities` | Comodidades |
| `location_amenity_locker` | Vestiário |
| `location_amenity_bar` | Bar |
| `location_amenity_bbq` | Churrasqueira |
| `location_amenity_parking` | Estacionamento |
| `location_amenity_wifi` | Wi-Fi |
| `location_amenity_stands` | Arquibancada |

#### Fields
| String ID | Valor |
|-----------|-------|
| `location_fields_title` | Quadras/Campos |
| `location_field_name` | Nome (ex: Quadra 1) |
| `location_field_type` | Tipo |
| `location_field_surface` | Piso |
| `location_field_price` | Preço/Hora (R$) |
| `location_field_dimensions` | Dimensões (m) |
| `location_field_covered` | Coberta? |
| `location_field_grass_type` | Grama Sintética |
| `location_field_owner` | Dono da Quadra (Opcional) |
| `location_field_no_fields` | Nenhuma quadra cadastrada neste local. |
| `location_instagram_handle` | Instagram |

---

### 👤 Profile Module (46 strings)

#### Profile Info
| String ID | Valor |
|-----------|-------|
| `profile_title` | Perfil |
| `profile_edit` | Editar Perfil |
| `profile_statistics` | Estatísticas |
| `profile_achievements` | Conquistas Recentes |
| `profile_user_badge` | Badge de nível |
| `profile_photo` | Foto de perfil |
| `profile_level_format` | Nível $level |

#### Roles
| String ID | Valor |
|-----------|-------|
| `profile_role_admin` | ADMINISTRADOR |
| `profile_role_organizer` | ORGANIZADOR |
| `profile_role_owner` | Dono |
| `profile_role_member` | Membro |

#### Preferences
| String ID | Valor |
|-----------|-------|
| `profile_field_preference_title` | Preferências de Campo |
| `profile_field_type_society` | Society |
| `profile_field_type_futsal` | Futsal |
| `profile_field_type_field` | Campo |
| `profile_position_preference` | Auto-Avaliação |
| `profile_position_attacker` | Atacante |
| `profile_position_midfielder` | Meio-Campo |
| `profile_position_defender` | Defensor |
| `profile_position_goalkeeper` | Goleiro |

#### Statistics
| String ID | Valor |
|-----------|-------|
| `profile_stats_games` | Jogos |
| `profile_stats_victories` | Vitórias |
| `profile_stats_draws` | Empates |
| `profile_stats_goals` | Gols |
| `profile_stats_assists` | Assistências |
| `profile_stats_mvp` | MVPs |
| `profile_stats_saves` | Defesas |
| `profile_stats_cards` | Cartões |
| `profile_stats_avg_goals` | Média Gols |

#### Skills
| String ID | Valor |
|-----------|-------|
| `profile_skill_attack` | Ataque |
| `profile_skill_midfield` | Meio-Campo |
| `profile_skill_defense` | Defesa |
| `profile_skill_goalkeeper` | Goleiro |

#### Menu
| String ID | Valor |
|-----------|-------|
| `profile_menu_notifications` | Notificações |
| `profile_menu_schedules` | Horários |
| `profile_menu_preferences` | Preferências |
| `profile_menu_settings` | Configurações da Liga |
| `profile_menu_manage_users` | Gerenciar Usuários |
| `profile_menu_manage_locations` | Gerenciar Locais |
| `profile_menu_my_locations` | Meus Locais |
| `profile_menu_about` | Sobre |
| `profile_menu_dev` | Developer Menu |
| `profile_version_format` | Versão ${BuildConfig.VERSION_NAME} |

---

### 🔘 Common Actions (28 strings)

| String ID | Valor |
|-----------|-------|
| `action_save` | Salvar |
| `action_delete` | Deletar |
| `action_remove` | Remover |
| `action_edit` | Editar |
| `action_cancel` | Cancelar |
| `action_close` | Fechar |
| `action_back` | Voltar |
| `action_confirm` | Confirmar |
| `action_invite` | Convidar |
| `action_promote` | Promover |
| `action_promote_admin` | Promover a Admin |
| `action_demote` | Rebaixar |
| `action_demote_member` | Rebaixar para Membro |
| `action_remove_from_group` | Remover do Grupo |
| `action_undo` | Desfazer |
| `action_clear` | Limpar |
| `action_clear_search` | Limpar Busca |
| `action_expand` | Expandir |
| `action_logout` | Sair |
| `action_try_again` | Tentar Novamente |
| `action_share` | Compartilhar |
| `action_open_maps` | Abrir no Mapa |
| `action_call` | Ligar |
| `action_whatsapp` | WhatsApp |
| `action_take_photo` | Tirar Foto |
| `action_choose_gallery` | Escolher da Galeria |
| `action_vote_mvp` | Votar MVP |
| `action_tactical_board` | Prancheta Tática |

---

### ❌ Error Messages (20 strings)

| String ID | Valor |
|-----------|-------|
| `error_generic` | Erro inesperado |
| `error_unknown` | Erro desconhecido |
| `error_loading_games` | Erro ao carregar jogos |
| `error_loading_game` | Erro ao carregar jogo |
| `error_loading_locations` | Erro ao carregar locais |
| `error_loading_players` | Erro ao carregar jogadores |
| `error_loading_data` | Erro ao carregar dados |
| `error_send_invite` | Erro ao enviar convite |
| `error_save_game` | Erro ao salvar jogo |
| `error_transfer_ownership` | Erro ao transferir propriedade |
| `error_promote_member` | Erro ao promover membro |
| `error_demote_member` | Erro ao rebaixar membro |
| `error_remove_member` | Erro ao remover membro |
| `error_leave_group` | Erro ao sair do grupo |
| `error_network` | Verifique sua conexão com a internet e tente novamente |
| `error_user_not_auth` | Usuário não autenticado |
| `error_user_not_found` | Usuário não encontrado |
| `error_notifications` | Erro ao observar notificacoes |
| `error_message_format` | Erro: ${e.message} |

---

### 📋 Dialogs & Confirmations

| String ID | Valor |
|-----------|-------|
| `dialog_edit_group` | Editar Grupo |
| `dialog_change_photo` | Alterar Foto |
| `dialog_transfer_ownership` | Transferir Propriedade |
| `dialog_transfer_message` | Selecione o novo dono do grupo |
| `dialog_transfer_no_members` | Nenhum membro disponivel para transferencia |
| `dialog_confirm_yes` | Sim |
| `dialog_confirm_no` | Não |
| `dialog_confirm_ok` | OK |
| `confirm_cancel_game` | Tem certeza que deseja cancelar este jogo? Todas as confirmações serão perdidas. |
| `confirm_delete_group` | Tem certeza que deseja deletar \ |
| `confirm_archive_group` | Tem certeza que deseja arquivar o grupo \ |
| `confirm_leave_group` | Tem certeza que deseja sair do grupo \ |
| `event_who_scored` | Quem fez o Gol? |
| `event_who_assisted` | Quem fez a Defesa? |
| `event_yellow_card_who` | Quem tomou cartão Amarelo? |
| `event_red_card_who` | Quem tomou cartão Vermelho? |

---

### 📅 Days of Week (7 strings)

| String ID | Valor |
|-----------|-------|
| `day_sunday` | Domingo |
| `day_monday` | Segunda-feira |
| `day_tuesday` | Terça-feira |
| `day_wednesday` | Quarta-feira |
| `day_thursday` | Quinta-feira |
| `day_friday` | Sexta-feira |
| `day_saturday` | Sábado |

---

### 🎖️ Badge & Statistics (12 strings)

#### Badge Rarity
| String ID | Valor |
|-----------|-------|
| `badge_rarity_comum` | COMUM |
| `badge_rarity_raro` | RARO |
| `badge_rarity_lendario` | LENDÁRIO |

#### Statistics
| String ID | Valor |
|-----------|-------|
| `stat_xp` | XP |
| `stat_admin` | Admin |
| `stat_mvp` | MVP |
| `stat_goals` | Gols |
| `stat_assists` | Assistências |
| `stat_saves` | Defesas |
| `stat_victories` | Vitórias |
| `stat_defeats` | Derrotas |
| `stat_presence` | Presença |

---

### 🏷️ Miscellaneous (23 strings)

| String ID | Valor |
|-----------|-------|
| `time_format_hhmm` | HH:mm |
| `currency_br` | BR |
| `currency_brl` | BRL |
| `timezone_utc` | UTC |
| `success_group_updated` | Grupo atualizado com sucesso |
| `success_group_archived` | Grupo arquivado com sucesso |
| `success_ownership_transferred` | Propriedade transferida para ${newOwner.getDisplayName()} |
| `success_loading` | Carregando... |
| `search_no_results` | Nenhum resultado para \ |
| `first_game_hint` | Que tal criar o primeiro jogo e reunir a galera? |
| `no_data_available` | Nenhum dado de ranking disponível |
| `data_load_error` | Não foi possível carregar os dados. Tente novamente. |
| `is_member` | Já é membro |
| `individual_payment` | Individual |
| `user_photo` | Foto do usuário |
| `real_time_label` | Tempo Real |
| `live_game_label` | Jogo ao Vivo |
| `end_game_label` | Fim de Jogo |
| `pending_label` | Pendente |
| `populate_database` | Popular Banco de Dados |
| `remove_duplicates` | Remover Duplicatas |
| `firebase_mode` | Modo atual: Firebase Real |
| `mock_mode` | Modo atual: Dados Mockados (FakeRepository) |

---

### 🔧 ViewModel Tags (7 strings)

| String ID | Valor |
|-----------|-------|
| `tag_create_game_vm` | CreateGameVM |
| `tag_game_detail_vm` | GroupDetailVM |
| `tag_field_selection_vm` | FieldSelectionVM |
| `tag_location_selection_vm` | LocationSelectionVM |
| `tag_live_game_vm` | LiveGameViewModel |
| `tag_player_card` | PlayerCard |
| `tag_compose_group_dialogs` | ComposeGroupDialogs |

---

## Busca por Padrão

Procurando uma string? Use o padrão:

```
<categoria>_<subcategoria>_<descrição>
```

**Exemplos**:
- Ação de jogo → `game_action_*`
- Erro de carregamento → `error_loading_*`
- Confirmação → `confirm_*` ou `dialog_confirm_*`
- Dia da semana → `day_*`
- Estatística → `stat_*` ou `profile_stats_*`

---

**Total de Strings**: 220
**Última Atualização**: 2026-01-07
**Versão**: 1.0
