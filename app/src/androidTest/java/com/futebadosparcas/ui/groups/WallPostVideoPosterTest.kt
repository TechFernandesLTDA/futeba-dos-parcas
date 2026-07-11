package com.futebadosparcas.ui.groups

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.ui.theme.FutebaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WallPostVideoPosterTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun videoMostraPosterAcionavelAntesDePrepararPlayer() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val post = GroupWallPost(
            id = "post-1",
            groupId = "group-1",
            authorId = "user-1",
            authorName = "Jordi",
            mediaUrl = "https://cdn.example/video.mp4",
            mediaType = "video/mp4",
            thumbnailUrl = "https://cdn.example/poster.jpg"
        )

        composeTestRule.setContent {
            FutebaTheme {
                WallPostCard(
                    post = post,
                    isOwn = false,
                    canManage = false,
                    currentUserId = null
                )
            }
        }

        composeTestRule.onNodeWithContentDescription(
            context.getString(R.string.group_wall_play_video)
        ).assertIsDisplayed()
        composeTestRule.onNodeWithContentDescription(
            context.getString(R.string.group_wall_video_poster),
            useUnmergedTree = true
        ).assertIsDisplayed()
    }
}
