package com.futebadosparcas.domain

import com.futebadosparcas.domain.util.SemVer
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SemVerTest {

    @Test
    fun `equal versions compare to zero`() {
        assertEquals(0, SemVer.compare("1.2.3", "1.2.3"))
        assertEquals(0, SemVer.compare("0.0.0", "0.0.0"))
    }

    @Test
    fun `major difference dominates`() {
        assertTrue(SemVer.compare("2.0.0", "1.9.9") > 0)
        assertTrue(SemVer.compare("1.0.0", "2.0.0") < 0)
    }

    @Test
    fun `minor difference compared when major equal`() {
        assertTrue(SemVer.compare("1.3.0", "1.2.9") > 0)
        assertTrue(SemVer.compare("1.2.0", "1.3.0") < 0)
    }

    @Test
    fun `patch difference compared when major and minor equal`() {
        assertTrue(SemVer.compare("1.2.4", "1.2.3") > 0)
        assertTrue(SemVer.compare("1.2.3", "1.2.4") < 0)
    }

    @Test
    fun `missing components count as zero`() {
        assertEquals(0, SemVer.compare("1.2", "1.2.0"))
        assertEquals(0, SemVer.compare("1", "1.0.0"))
        assertTrue(SemVer.compare("1.2.1", "1.2") > 0)
    }

    @Test
    fun `v prefix is ignored`() {
        assertEquals(0, SemVer.compare("v1.2.3", "1.2.3"))
        assertEquals(0, SemVer.compare("V1.2.3", "v1.2.3"))
    }

    @Test
    fun `pre-release and build suffixes are stripped`() {
        assertEquals(0, SemVer.compare("1.2.3-beta", "1.2.3"))
        assertEquals(0, SemVer.compare("1.2.3+42", "1.2.3"))
        assertEquals(0, SemVer.compare("1.2.3-rc.1+build", "1.2.3"))
    }

    @Test
    fun `non-numeric components degrade to zero`() {
        assertEquals(0, SemVer.compare("1.x.3", "1.0.3"))
        assertEquals(0, SemVer.compare("abc", "0.0.0"))
    }

    @Test
    fun `double-digit components compare numerically not lexically`() {
        assertTrue(SemVer.compare("1.10.0", "1.9.0") > 0)
        assertTrue(SemVer.compare("1.26.0", "1.6.0") > 0)
    }

    @Test
    fun `isNewer reflects strict ordering`() {
        assertTrue(SemVer.isNewer("1.27.0", "1.26.0"))
        assertFalse(SemVer.isNewer("1.26.0", "1.26.0"))
        assertFalse(SemVer.isNewer("1.25.0", "1.26.0"))
    }
}
