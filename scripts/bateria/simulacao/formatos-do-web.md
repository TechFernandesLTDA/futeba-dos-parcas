# Web write shapes (web/src, verified from code)
Paths relative to web/src. `ts` = serverTimestamp(). `uid` = auth uid. Callables defined in services/cloudFunctions.ts.

## 1. Create group — DIRECT writeBatch (hooks/useGroups.ts:368-438, batch.commit :438)
Optional photo afterwards: updateDoc(groups/{gid},{photo_url,updated_at:ts}) + updateDoc(users/{uid}/groups/{gid},{group_photo}) (:448-455).
```ts
gid = doc(collection(db,'groups')).id
batch.set(groups/{gid}, {                      // :414
  name, description: description||'', photo_url: null,
  type: isPublic?'PUBLIC':'PRIVATE', is_public: isPublic||false,
  owner_id: uid, owner_name: displayName,      // firebaseUser.displayName||user.name||'Dono'
  member_count: 0,                             // onMemberWritten trigger counts owner
  members: [uid], total_games_played: 0, status: 'ACTIVE',
  created_at: ts, updated_at: ts,
  /* only if defaultGender */ default_gender
})
batch.set(groups/{gid}/members/{uid}, {        // :416
  user_id: uid, user_name: displayName, user_photo_url: photoURL||null,
  role: 'OWNER', status: 'ACTIVE', joined_at: ts, total_games: 0, level: user.level ?? 0 })
batch.set(users/{uid}/groups/{gid}, {          // :429
  group_id: gid, group_name: name, group_photo: null, role: 'OWNER', member_count: 1, joined_at: ts })
```

## 2. Invites
### 2a. Invite specific player — DIRECT addDoc (pages/groups/InvitePlayersScreen.tsx:228; same shape in hooks/useLeagueInvites.ts:102 via setDoc(doc(collection)))
Pre-checks (reads): groups/{gid}/members/{target} (must not exist or be REMOVED/INACTIVE); group_invites where group_id==gid & invited_user_id==target & status=='PENDING' empty; sender pending (invited_by_id,group_id,PENDING) < 20.
Rules (firestore.rules:3100): create ONLY by group OWNER (isGroupOwnerById), expires_at < now+7d, target != self.
```ts
addDoc(collection('group_invites'), {
  group_id, group_name, group_photo: null,     // useLeagueInvites: group.photoUrl||null
  invited_by_id: uid, invited_by_name: user.name||firebaseUser.displayName||'Organizador',
  invited_user_id, invited_user_name, invited_user_photo: photoUrl||null,
  status: 'PENDING',
  expires_at: Timestamp.fromDate(new Date(Date.now()+24*3600*1000)),
  created_at: ts, updated_at: ts })
```
### 2b. Accept / Decline — DIRECT writeBatch (hooks/useNotifications.ts:195-222 respondToGroupInvite)
```ts
batch.update(group_invites/{inviteId}, { status: 'ACCEPTED'|'DECLINED', updated_at: ts })  // rules: invitee only, PENDING, not expired, keys hasOnly [status,updated_at]
batch.update(notifications/{notificationId}, { read: true, read_at: ts })                  // needs an existing notif doc (created by trigger onGroupInviteCreated); simulator may omit
```
Membership on ACCEPTED is created SERVER-SIDE by trigger onGroupInviteResponse (functions/src/notifications/presence-notifications.ts:629, createMembershipForAcceptedGroupInvite). Client writes no member doc. Inviter may cancel: update {status:'CANCELLED', updated_at}.
### 2c. Join by invite code
- Generate code: CALLABLE `generateGroupInviteCode` payload `{ groupId, groupName }` -> `{ code }` (useGroups.ts:557).
- Redeem: DIRECT runTransaction (useGroups.ts:590-650), doc `invites/{CODE_UPPERCASE}`:
```ts
tx.get(invites/{CODE}); tx.get(groups/{gid}/members/{uid}); tx.get(groups/{gid}/blocked_players/{uid})
tx.update(invites/{CODE}, { used: true, used_by: uid, used_at: ts })
```
gid = invite.group_id || invite.groupId. Client then waits (8s onSnapshot) for groups/{gid}/members/{uid} to appear; created by trigger onInviteRedeemed (functions/src/groups/invite-redeemed.ts). Client does NOT write member or users/{uid}/groups.
- `validateInviteCode` callable `{ inviteCode }` is only used in AuthContext signup (platform invite), NOT group join.
### 2d. Request to join — DIRECT (hooks/useJoinRequests.ts)
```ts
setDoc(groups/{gid}/join_requests/{uid}, { user_id: uid, user_name: user.name||user.email||'Anonimo', user_photo: user.photoUrl??null, status: 'PENDING', requested_at: ts })  // :103
deleteDoc(groups/{gid}/join_requests/{uid})   // cancel :126
// admin approve/reject: runTransaction, tx.get then tx.update(groups/{gid}/join_requests/{requesterId}, { status:'APPROVED'|'REJECTED', responded_at: ts, responded_by: uid }) :230/:262
```
Membership then created by trigger onJoinRequestApproved (functions/src/groups/join-requests.ts).

## 3. Leave / remove / promote — DIRECT writeBatch
### Leave (pages/group/GroupSettingsScreen.tsx:116 -> removeGroupMembershipArtifacts(gid, uid, 'INACTIVE'), hooks/useGroups.ts:41-73). Owner cannot leave.
### Remove member (GroupSettingsScreen.tsx:193 -> removeGroupMembershipArtifacts(gid, memberId, 'REMOVED', {cleanupConfirmations: isOwner}))
```ts
// pre-read: getDocs(query(games, where('group_id','==',gid)))
batch.update(groups/{gid}/members/{userId}, { status: 'INACTIVE'|'REMOVED', updated_at: ts })
batch.delete(users/{userId}/groups/{gid})
// if cleanupConfirmations!==false, for each game of group w/o deleted_at/deletedAt and status in GROUP_CONFIRMATION_CLEANUP_STATUSES (check const in useGroups.ts):
batch.update(confirmations/{gameId}_{userId}, { status: 'CANCELLED', updated_at: ts })   // NOTE update on possibly nonexistent doc fails the whole batch
```
### Promote (GroupSettingsScreen.tsx:159-161; owner only)
```ts
batch.update(groups/{gid}/members/{memberId}, { role: 'ADMIN' })
batch.update(users/{memberId}/groups/{gid}, { role: 'ADMIN' })
```
Demote: same with role 'MEMBER' (:179). Transfer ownership (:216-223): update groups/{gid} {owner_id, owner_name}; members/{uid} role 'ADMIN'; users/{uid}/groups/{gid} role 'ADMIN'; members/{target} role 'OWNER'; users/{target}/groups/{gid} {role:'OWNER', group_name}.

## 4. Create game — DIRECT addDoc (hooks/useGames.ts:662-746, caller pages/game/CreateGameScreen.tsx:848-893)
Pre-checks (reads): groups/{gid} must exist, owner_id==uid, status!='DELETED', member_count >= 5 (MIN_GROUP_MEMBERS_TO_CREATE_GAME). groupId REQUIRED.
Form payload (camelCase) is run through camelToSnake (utils/camelToSnake.ts), undefined removed, then spread:
```ts
// CreateGameScreen gamePayload (camelCase -> snake_case):
name: `${gameType||'Jogo'} - ${locationName}`, date: 'yyyy-MM-dd' (string), time: 'HH:mm', end_time,
location_id: ''|id, location_name, location_address, field_id: ''|id, field_name, field_type, game_type,
max_players, max_goalkeepers, number_of_teams, total_cost, daily_price, price_manual_override,
pix_payment_enabled, pix_key, pix_key_type, pix_beneficiary_name, rules,
group_id, group_name, visibility /* 'PUBLIC_OPEN'|'PUBLIC_CLOSED'|<private value> */,
recurrence_enabled, recurrence_type /* weekly|biweekly|monthly */, [recurrence_count | recurrence_end_date],
stream_url (trimmed), auto_invite_members, gender, created_by: uid
// NOTE: web does NOT write dateTime (only date+time strings) unless gameData.dateTime given (it isn't).
addDoc(collection('games'), {
  ...above,
  gender: gender ?? 'MIXED',
  is_public: visibility==='PUBLIC_OPEN'||visibility==='PUBLIC_CLOSED',   // utils/gameLifecycle.ts:10
  owner_id: uid, owner_name: displayName /* firebaseUser.displayName||user.name||'Organizador' */,
  status: 'SCHEDULED', players_count: 0, goalkeepers_count: 0, players: [],
  team1_score: 0, team2_score: 0, voting_concluded: false, post_game_report_generated: false,
  auto_closed: false, co_organizers: [], created_at: ts, updated_at: ts })
```
"Mark public" = only via visibility at creation -> is_public (no later toggle found in web).
Side writes (CreateGameScreen:896, hooks/useAutoInviteMembers.ts:52-93) when auto_invite_members && groupId:
```ts
// reads groups/{gid}/members (getDocs) ; skip self/inactive; skip if confirmations/{gid}_{m} exists
batch.set(confirmations/{gameId}_{memberId}, { game_id, user_id: memberId, user_name: member.display_name||member.name||users.name||'Jogador',
  status: 'PENDING', position: 'FIELD', is_casual_player: false, created_at: ts })
// then owner auto-confirm via CALLABLE confirmGamePresence {gameId, position:'FIELD', isCasualPlayer:false} (errors swallowed)
```

## 5. Presence / waitlist
- Confirm: CALLABLE `confirmGamePresence` `{ gameId, position: 'GOALKEEPER'|'FIELD', isCasualPlayer: false }` (useGames.ts:569-583; rules block client CONFIRMED writes). Returns {success, alreadyConfirmed, confirmationId, position, expectedPayment, expectedPaymentCents}.
- Join public game: CALLABLE `joinPublicGame` `{ gameId, position:'FIELD', isCasualPlayer:false }` (hooks/usePublicGames.ts:119).
- Manager confirms another: CALLABLE `confirmPlayerAsManager` `{ gameId, userId }` (pages/game/PendingPlayersSection.tsx:40) — optional position.
- Waitlist: CALLABLE `joinGameWaitlist` `{ gameId, position: 'LINE' }` (hooks/useWaitlist.ts:143; default position 'LINE').
- Cancel presence: DIRECT writeBatch (useGames.ts:626-643), after getDoc(confirmations/{gameId}_{uid}) must exist:
```ts
batch.update(confirmations/{gameId}_{uid}, { status: 'CANCELLED', updated_at: ts })
// if game_rides/{gameId}_{uid} exists & shouldCancelRideOnPresenceCancellation:
batch.update(game_rides/{gameId}_{uid}, { status: 'CANCELLED', updated_at: ts })
```
- Invitee declines PENDING game invite (hooks/useNotifications.ts:174): batch.delete(confirmations/{gameId}_{uid}) + batch.update(notifications/{nid},{read:true,read_at:ts}).

## 6. Teams + status
- Save teams: DIRECT runTransaction on games/{gid} ONLY (pages/games/TeamFormationScreen.tsx:383-399). No teams/{id} doc and NO confirmations.team_id written by web.
```ts
tx.get(games/{gid}); require (data.team_formation_version ?? 0) === expectedVersion
tx.update(games/{gid}, { team1_players: string[] /*uids*/, team2_players: string[],
  team1_name: t('games.teams.A'), team2_name: t('games.teams.B'),
  team_formation_version: expectedVersion + 1, updated_at: ts })
```
(Collection `teams` is only READ in web — LiveGameScreen/useHeadToHead; created elsewhere, e.g. Functions/Android.)
- Status SCHEDULED->CONFIRMED: DIRECT updateDoc (hooks/useGames.ts:808; caller GameDetailScreen.tsx:462):
```ts
updateDoc(games/{gid}, { status: 'CONFIRMED', updated_at: ts })   // valid: SCHEDULED->CONFIRMED|CANCELLED; CONFIRMED->LIVE|CANCELLED; LIVE->FINISHED
```
Lifecycle callables also exist: startGameLifecycle, finishGameLifecycle (cloudFunctions.ts:826/831).
- Edit game (GameDetailScreen.tsx:601-623) tx.update games/{gid} {date,time,dateTime:Timestamp,max_players,rules,updated_at}.

## 7. Social writes
### Game comment — DIRECT addDoc games/{gid}/comments (hooks/useGameComments.ts:248)
```ts
{ author_id: uid, author_name: user.name||displayName||'Jogador', author_photo_url: user.photoUrl??photoURL??null,
  text /*trimmed 1..GAME_COMMENT_MAX_LENGTH*/, parent_id: parentId|null, created_at: ts,
  edited_at: null, deleted_by: null, deleted_at: null, reactions: {}, context: 'game'|'vote_result' }
// edit: updateDoc {text, edited_at: ts}; delete: updateDoc {deleted_by: uid, deleted_at: ts}
```
### Game chat — DIRECT addDoc games/{gid}/chat (hooks/useGameChat.ts:140)
```ts
{ sender_id: uid, sender_name, sender_photo_url, text, created_at: ts, deleted_by: null, deleted_at: null }
// delete: updateDoc {deleted_by: uid, deleted_at: ts}
```
### Group wall post (text only) — DIRECT addDoc groups/{gid}/wall_posts (hooks/useGroupWall.ts:428)
```ts
{ group_id, author_id: uid, author_name, author_photo_url, text, media_url: null, media_path: null, media_type: null,
  thumbnail_path: null, highlight_ref: options.highlightRef ?? null, pinned: false, pinned_by: null, pinned_at: null,
  reactions: {}, comments_count: 0, created_at: ts, updated_at: ts, edited_at: null, deleted_by: null, deleted_at: null }
```
(media posts go through a callable draft + Storage upload — createGroupWallMediaDraft; skip.) Edit: update {text, edited_at, updated_at}. Soft delete: batch.update {deleted_by, deleted_at, updated_at}. Pin: {pinned, pinned_by, pinned_at, updated_at}.
### Group poll create — DIRECT addDoc `group_polls` (root collection; hooks/useGroupPolls.ts:200)
```ts
{ group_id, question /*3..120*/, options: [{id:'option_1', text /*<=60*/}, ...] /*2..5*/,
  created_by: uid, created_by_name, status: 'ACTIVE', created_at: ts, updated_at: ts }
```
### Poll vote — DIRECT setDoc `group_poll_votes/{pollId}_{uid}` (:227)
```ts
{ poll_id, group_id, option_id, user_id: uid, updated_at: ts }
```
### Game ride (carona) — DIRECT writeBatch (hooks/useGameRides.ts:156-210)
```ts
batch.set(game_rides/{gameId}_{uid}, {   // merge:true if own ride exists, else + created_at
  game_id, group_id: game.groupId||null, user_id: uid, user_name /*firebaseUser.displayName||user.name||user.nickname||'Jogador'*/,
  user_photo /*photoURL||user.photoUrl||''*/, type: 'OFFER'|'REQUEST', origin_label /*2..120*/, destination_label /*default game.locationName*/,
  seats: type==='OFFER' ? 1..8 : null, note /*<=180*/, status: 'ACTIVE', updated_at: ts, [created_at: ts] })
// up to 20 notifications to riders of opposite type (optional for sim):
batch.set(notifications/{auto}, { user_id: target, created_by: uid, type:'GAME_RIDE', title, body, message, reference_id: gameId,
  reference_type:'game', action_type:'OPEN_GAME', game_id, group_id: game.groupId||null, read:false, created_at: ts })
// cancel: batch.update(game_rides/{gameId}_{uid}, { status:'CANCELLED', updated_at: ts })
```

## 8. Misc
- Cashbox entry: CALLABLE `createCashboxEntry` `{ groupId, requestId: crypto.randomUUID(), type:'INCOME'|'EXPENSE', amount: number /*reais, centsToCashboxAmount*/, description, receiptUrl?: string|null }` -> {entryId, balance, balanceCents} (pages/groups/CashboxScreen.tsx:278). Also voidCashboxEntry {groupId, entryId}.
- MVP votes: CALLABLE `submitMvpVotes` `{ gameId, votes: [{ votedPlayerId, category: 'MVP'|'BEST_GOALKEEPER'|'WORST' }] }` -> {success, voteIds, ballotComplete, message} (pages/game/MVPVoteScreen.tsx:258). Single: `submitMvpVote` {gameId, votedPlayerId, category}. Conclude: `concludeMvpVoting` {gameId}. Client only READS mvp_votes/{gameId}_{uid}_{category}.
- Post-game reputation: CALLABLE `submitPostGameReputation` `{ gameId, targetUserId, punctuality, respect, commitment, comment: trimmed string }` (hooks/usePostGameReputation.ts:108; numeric ratings, comment always sent, may be '').
- Follow: CALLABLE `toggleFollowUser` `{ targetUserId, follow: boolean }` -> {success, following, changed} (hooks/useFollowUser.ts:55).
- Direct message: CALLABLE `createDirectChat` `{ targetUid }` -> {chatId} (hooks/useDirectMessages.ts:302) then CALLABLE `submitDirectMessage` `{ chatId, text /*1..DIRECT_MESSAGE_MAX_LENGTH*/ }` -> {messageId} (:267). Delete msg is direct updateDoc chats/{chatId}/messages/{id} {deleted_by: uid, deleted_at: ts}.
- Content report: CALLABLE `submitContentReport` `{ targetType: 'group_wall_post'|'game_chat_message'|'game_comment'|'game_photo'|'game_video', groupId?, postId?, gameId?, targetId?, reason: 'inappropriate_content'|'abusive_language'|'spam'|'harassment'|'other' }` -> {reportId}. Web only calls it for wall posts: `{targetType:'group_wall_post', groupId, postId, reason:'inappropriate_content'}` (hooks/useSocialFeed.ts:135).
- Location/field review: DIRECT on `locations/{locationId}/reviews/{uid}` (pages/locations/LocationDetailScreen.tsx:376-396):
```ts
reviewData = { user_name: user.name||'Anônimo', user_photo: user.photoUrl||null, rating: number, comment: trimmed (required non-empty) }
create: setDoc(ref, { user_id: uid, ...reviewData, created_at: ts })
edit:   updateDoc(ref, { ...reviewData, updated_at: ts })
```
