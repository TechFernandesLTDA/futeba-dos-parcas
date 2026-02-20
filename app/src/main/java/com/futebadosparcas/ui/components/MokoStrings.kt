package com.futebadosparcas.ui.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import org.jetbrains.compose.resources.stringResource
/**
 * Extensões para facilitar o uso de strings do Android
 * em telas Compose.
 */

// Actions
@Composable
@ReadOnlyComposable
fun stringClose() = stringResource(Res.string.action_close)
@Composable
@ReadOnlyComposable
fun stringCancel() = stringResource(Res.string.action_cancel)
@Composable
@ReadOnlyComposable
fun stringSave() = stringResource(Res.string.action_save)
@Composable
@ReadOnlyComposable
fun stringConfirm() = stringResource(Res.string.action_confirm)
@Composable
@ReadOnlyComposable
fun stringDelete() = stringResource(Res.string.action_delete)
@Composable
@ReadOnlyComposable
fun stringEdit() = stringResource(Res.string.action_edit)
@Composable
@ReadOnlyComposable
fun stringRetry() = stringResource(Res.string.action_retry)

// Common
@Composable
@ReadOnlyComposable
fun stringYes() = stringResource(Res.string.common_yes)
@Composable
@ReadOnlyComposable
fun stringNo() = stringResource(Res.string.common_no)
@Composable
@ReadOnlyComposable
fun stringLoading() = stringResource(Res.string.loading)

// Errors
@Composable
@ReadOnlyComposable
fun stringErrorDefault() = stringResource(Res.string.error_default)
@Composable
@ReadOnlyComposable
fun stringErrorNetwork() = stringResource(Res.string.error_network)

// Profile
@Composable
@ReadOnlyComposable
fun stringProfileEdit() = stringResource(Res.string.profile_edit)
@Composable
@ReadOnlyComposable
fun stringProfileFullName() = stringResource(Res.string.profile_full_name)
@Composable
@ReadOnlyComposable
fun stringProfileNickname() = stringResource(Res.string.profile_nickname)
@Composable
@ReadOnlyComposable
fun stringProfileBirthDate() = stringResource(Res.string.profile_birth_date)

// Edit Profile
@Composable
@ReadOnlyComposable
fun stringEditProfileTitle() = stringResource(Res.string.edit_profile_title)
@Composable
@ReadOnlyComposable
fun stringEditProfileSave() = stringResource(Res.string.edit_profile_save)
@Composable
@ReadOnlyComposable
fun stringEditProfileBasicInfo() = stringResource(Res.string.edit_profile_basic_info)
@Composable
@ReadOnlyComposable
fun stringEditProfilePhysicalInfo() = stringResource(Res.string.edit_profile_physical_info)

// Game
@Composable
@ReadOnlyComposable
fun stringGameDetails() = stringResource(Res.string.game_details)
@Composable
@ReadOnlyComposable
fun stringGameLive() = stringResource(Res.string.game_live)

// Locations
@Composable
@ReadOnlyComposable
fun stringLocationsTitle() = stringResource(Res.string.locations_title)
