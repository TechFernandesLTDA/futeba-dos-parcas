package com.futebadosparcas.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.R

/**
 * Extensões para facilitar o uso de strings do Android
 * em telas Compose.
 */

// Actions
@Composable
@ReadOnlyComposable
fun stringClose() = stringResource(R.string.action_close)
@Composable
@ReadOnlyComposable
fun stringCancel() = stringResource(R.string.action_cancel)
@Composable
@ReadOnlyComposable
fun stringSave() = stringResource(R.string.action_save)
@Composable
@ReadOnlyComposable
fun stringConfirm() = stringResource(R.string.action_confirm)
@Composable
@ReadOnlyComposable
fun stringDelete() = stringResource(R.string.action_delete)
@Composable
@ReadOnlyComposable
fun stringEdit() = stringResource(R.string.action_edit)
@Composable
@ReadOnlyComposable
fun stringRetry() = stringResource(R.string.action_retry)

// Common
@Composable
@ReadOnlyComposable
fun stringYes() = stringResource(R.string.common_yes)
@Composable
@ReadOnlyComposable
fun stringNo() = stringResource(R.string.common_no)
@Composable
@ReadOnlyComposable
fun stringLoading() = stringResource(R.string.loading)

// Errors
@Composable
@ReadOnlyComposable
fun stringErrorDefault() = stringResource(R.string.error_default)
@Composable
@ReadOnlyComposable
fun stringErrorNetwork() = stringResource(R.string.error_network)

// Profile
@Composable
@ReadOnlyComposable
fun stringProfileEdit() = stringResource(R.string.profile_edit)
@Composable
@ReadOnlyComposable
fun stringProfileFullName() = stringResource(R.string.profile_full_name)
@Composable
@ReadOnlyComposable
fun stringProfileNickname() = stringResource(R.string.profile_nickname)
@Composable
@ReadOnlyComposable
fun stringProfileBirthDate() = stringResource(R.string.profile_birth_date)

// Edit Profile
@Composable
@ReadOnlyComposable
fun stringEditProfileTitle() = stringResource(R.string.edit_profile_title)
@Composable
@ReadOnlyComposable
fun stringEditProfileSave() = stringResource(R.string.edit_profile_save)
@Composable
@ReadOnlyComposable
fun stringEditProfileBasicInfo() = stringResource(R.string.edit_profile_basic_info)
@Composable
@ReadOnlyComposable
fun stringEditProfilePhysicalInfo() = stringResource(R.string.edit_profile_physical_info)

// Game
@Composable
@ReadOnlyComposable
fun stringGameDetails() = stringResource(R.string.game_details)
@Composable
@ReadOnlyComposable
fun stringGameLive() = stringResource(R.string.game_live)

// Locations
@Composable
@ReadOnlyComposable
fun stringLocationsTitle() = stringResource(R.string.locations_title)
