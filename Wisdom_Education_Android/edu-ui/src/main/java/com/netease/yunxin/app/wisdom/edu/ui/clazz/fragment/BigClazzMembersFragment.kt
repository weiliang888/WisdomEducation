/*
 * Copyright (c) 2021 NetEase, Inc.  All rights reserved.
 * Use of this source code is governed by a MIT license that can be found in the LICENSE file.
 */

package com.netease.yunxin.app.wisdom.edu.ui.clazz.fragment

import android.view.View
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator
import com.netease.yunxin.app.wisdom.base.util.ToastUtil
import com.netease.yunxin.app.wisdom.edu.logic.model.NEEduStateValue
import com.netease.yunxin.app.wisdom.edu.ui.R
import com.netease.yunxin.app.wisdom.edu.ui.base.BaseClassActivity
import com.netease.yunxin.app.wisdom.edu.ui.base.BaseFragment
import com.netease.yunxin.app.wisdom.edu.ui.databinding.FragmentBigclazzMembersBinding
import com.netease.yunxin.app.wisdom.edu.ui.viewbinding.viewBinding
import com.netease.yunxin.kit.alog.ALog

class BigClazzMembersFragment : BaseFragment(R.layout.fragment_bigclazz_members) {
    private val binding: FragmentBigclazzMembersBinding by viewBinding()
    private val fragmentList: MutableList<Fragment> = ArrayList()

    override fun initData() {
        eduManager.getHandsUpService().onHandsUpStateChange().observe(this, { updateAttachmentMembersText() })
        eduManager.getMemberService().onMemberJoin().observe(this, { updateAllMembersText() })
        //eduManager.getMemberService().onMemberLeave().observe(this, { updateAllMembersText() })
        updateAttachmentMembersText()
        updateAllMembersText()

    }

    private fun updateAttachmentMembersText() {
        eduManager?.getHandsUpService().getOnStageMemberList().filter { !it.isHost() }.let { t ->
            binding.tablayout.getTabAt(0)?.text = getString(R.string.attachment_members, t.size)
        }
    }

    private fun updateAllMembersText() {
        eduManager?.getMemberService().getMemberList().filter { !it.isHost() }.let { t ->
            binding.tablayout.getTabAt(1)?.text = getString(R.string.all_members, t.size)
        }
    }

    override fun initViews() {
        binding.apply {
            fragmentList.add(MemberStageFragment())
            fragmentList.add(MemberStudentsFragment())
            //初始化viewPage
            viewpager!!.adapter = object : FragmentStateAdapter(requireActivity()) {
                override fun getItemCount(): Int {
                    return fragmentList.size
                }

                override fun createFragment(position: Int): Fragment {
                    return fragmentList[position]
                }
            }
            val titles = arrayOf(getString(R.string.attachment_members, 0), getString(R.string.all_members, 0))
            TabLayoutMediator(
                tablayout, viewpager) { tab: TabLayout.Tab, position: Int ->
                tab.text = titles[position]
            }.attach()
            ivMemberHide.setOnClickListener {
                (activity as BaseClassActivity).hideFragmentWithMembers()
            }
            if (eduManager.getEntryMember().isHost()) {
                muteAudioAll.visibility = View.VISIBLE
                muteAudioAll.setOnClickListener {
                    eduManager.getRtcService()
                        .muteAllAudio(roomUuid = eduManager.eduEntryRes.room.roomUuid, NEEduStateValue.OPEN)
                        .observe(this@BigClazzMembersFragment, {
                            if (it.success()) {
                                ALog.i(tag, "muteAudioAll success")
                                ToastUtil.showShort(R.string.operation_successful)
                            } else {
                                ALog.i(tag, "muteAudioAll fail code=${it.code}")
                                ToastUtil.showShort(R.string.operation_fail)
                            }
                        })
                }

                cbMuteChatAll.visibility = View.VISIBLE
                tvMuteChatAll.visibility = View.VISIBLE
                cbMuteChatAll.setOnCheckedChangeListener { buttonView, isChecked ->
                    eduManager.getIMService()
                        .muteAllChat(roomUuid = eduManager.eduEntryRes.room.roomUuid,
                            if (isChecked) NEEduStateValue.OPEN else NEEduStateValue.CLOSE)
                        .observe(this@BigClazzMembersFragment, {
                            if (it.success()) {
                                ALog.i(tag, "muteChatAll success")
                                ToastUtil.showShort(R.string.operation_successful)
                            } else {
                                ALog.i(tag, "muteChatAll fail code=${it.code}")
                                ToastUtil.showShort(R.string.operation_fail)
                            }
                        })
                }
            }
        }
    }

}