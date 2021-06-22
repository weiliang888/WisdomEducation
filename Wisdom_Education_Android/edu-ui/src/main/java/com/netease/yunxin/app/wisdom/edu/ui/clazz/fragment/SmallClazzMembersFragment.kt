/*
 * Copyright (c) 2021 NetEase, Inc.  All rights reserved.
 * Use of this source code is governed by a MIT license that can be found in the LICENSE file.
 */

package com.netease.yunxin.app.wisdom.edu.ui.clazz.fragment

import android.view.View
import androidx.recyclerview.widget.LinearLayoutManager
import com.netease.yunxin.app.wisdom.base.util.ToastUtil
import com.netease.yunxin.app.wisdom.edu.logic.model.NEEduMember
import com.netease.yunxin.app.wisdom.edu.logic.model.NEEduStateValue
import com.netease.yunxin.app.wisdom.edu.ui.R
import com.netease.yunxin.app.wisdom.edu.ui.base.BaseClassActivity
import com.netease.yunxin.app.wisdom.edu.ui.base.BaseFragment
import com.netease.yunxin.app.wisdom.edu.ui.clazz.adapter.BaseAdapter
import com.netease.yunxin.app.wisdom.edu.ui.clazz.adapter.MemberControlListAdapter
import com.netease.yunxin.app.wisdom.edu.ui.databinding.FragmentSmallclazzMembersBinding
import com.netease.yunxin.app.wisdom.edu.ui.viewbinding.viewBinding
import com.netease.yunxin.kit.alog.ALog

class SmallClazzMembersFragment : BaseFragment(R.layout.fragment_smallclazz_members),
    BaseAdapter.OnItemChildClickListener<NEEduMember> {
    private val binding: FragmentSmallclazzMembersBinding by viewBinding()
    private lateinit var adapter: MemberControlListAdapter

    override fun initData() {
        adapter = MemberControlListAdapter(requireContext(),
            eduManager.getMemberService().getMemberList().filter { !it.isHost() } as MutableList<NEEduMember>)
        adapter.setOnItemChildClickListener(this)
        if (eduManager.getEntryMember().isHost()) adapter.isGrantMore = true
        eduManager.getMemberService().onMemberJoin().observe(this, { t ->
            adapter.updateDataAndNotify(t.filter { !it.isHost() })
            updateAllMembersText()
        })
        eduManager.getRtcService().onStreamChange().observe(this, { t -> adapter.refreshDataAndNotify(t.first) })
        eduManager.getBoardService().onSelfPermissionGranted().observe(this, { t -> adapter.refreshDataAndNotify(t) })
        eduManager.getShareScreenService().onSelfPermissionGranted().observe(this, { t -> adapter.refreshDataAndNotify(t) })
        updateAllMembersText()
    }

    private fun updateAllMembersText() {
        eduManager.getMemberService().getMemberList().filter { !it.isHost() }.let { t ->
            binding.titleMember.text = getString(R.string.all_room_members, t.size)
        }
    }

    override fun initViews() {
        val layoutManager = LinearLayoutManager(context)
        binding.apply {
            rcvMemberList.layoutManager = layoutManager
            rcvMemberList.adapter = adapter
            ivMemberHide.setOnClickListener {
                (activity as BaseClassActivity).hideFragmentWithMembers()
            }
            if (eduManager.getEntryMember().isHost()) {
                muteAudioAll.visibility = View.VISIBLE
                muteAudioAll.setOnClickListener {
                    eduManager.getRtcService()
                        .muteAllAudio(roomUuid = eduManager.eduEntryRes.room.roomUuid, NEEduStateValue.OPEN)
                        .observe(this@SmallClazzMembersFragment, {
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
                cbMuteChatAll.setOnCheckedChangeListener { _, isChecked ->
                    eduManager.getIMService().muteAllChat(
                        roomUuid = eduManager.eduEntryRes.room.roomUuid,
                        if (isChecked) NEEduStateValue.OPEN else NEEduStateValue.CLOSE
                    ).observe(this@SmallClazzMembersFragment, {
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

    override fun onItemChildClick(adapter: BaseAdapter<NEEduMember>?, v: View?, position: Int) {
        activity?.let { it as BaseClassActivity }?.apply {
            adapter?.let { it1 ->
                val member = it1.getItem(position)
                val self = eduManager.isSelf(member.userUuid)
                when (v!!.id) {
                    R.id.iv_member_more -> showActionSheetDialog(it1.getItem(position))
                    R.id.iv_member_audio -> if (self) switchLocalAudio().observe(this, { })
                    else switchRemoteUserAudio(it1.getItem(position))
                    R.id.iv_member_video -> if (self) switchLocalVideo().observe(this, { })
                    else switchRemoteUserVideo(it1.getItem(position))
                }
            }
        }
    }

}