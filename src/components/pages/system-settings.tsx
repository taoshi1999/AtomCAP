"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Switch } from "@/src/components/ui/switch"
import { Separator } from "@/src/components/ui/separator"

export function SystemSettings() {
  const [emailNotif, setEmailNotif] = useState(true)
  const [pushNotif, setPushNotif] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState(true)

  return (
    <div className="h-full overflow-auto bg-[#F3F4F6]">
      <div className="mx-auto max-w-2xl px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">系统设置</h1>
          <p className="mt-1 text-sm text-[#6B7280]">管理个人资料和系统偏好</p>
        </div>

        {/* Profile */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">个人资料</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#374151]">姓名</Label>
                <Input defaultValue="张伟" className="mt-1.5 border-[#E5E7EB]" />
              </div>
              <div>
                <Label className="text-sm text-[#374151]">职位</Label>
                <Input defaultValue="投资副总裁" className="mt-1.5 border-[#E5E7EB]" />
              </div>
            </div>
            <div>
              <Label className="text-sm text-[#374151]">电子邮箱</Label>
              <Input
                defaultValue="zhangwei@fund.com"
                className="mt-1.5 border-[#E5E7EB]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#374151]">手机号码</Label>
              <Input
                defaultValue="+86 138-0000-0000"
                className="mt-1.5 border-[#E5E7EB]"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">通知偏好</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#374151]">邮件通知</p>
                <p className="text-xs text-[#6B7280]">接收项目更新和重要提醒</p>
              </div>
              <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
            </div>
            <Separator className="bg-[#E5E7EB]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#374151]">推送通知</p>
                <p className="text-xs text-[#6B7280]">浏览器端推送即时消息</p>
              </div>
              <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
            </div>
            <Separator className="bg-[#E5E7EB]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#374151]">周报汇总</p>
                <p className="text-xs text-[#6B7280]">每周一发送项目进展周报</p>
              </div>
              <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">修改密码</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-[#374151]">当前密码</Label>
              <Input type="password" className="mt-1.5 border-[#E5E7EB]" />
            </div>
            <div>
              <Label className="text-sm text-[#374151]">新密码</Label>
              <Input type="password" className="mt-1.5 border-[#E5E7EB]" />
            </div>
            <div>
              <Label className="text-sm text-[#374151]">确认新密码</Label>
              <Input type="password" className="mt-1.5 border-[#E5E7EB]" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end pb-6">
          <Button className="gap-2 bg-[#2563EB] text-white hover:bg-[#1D4ED8]">
            <Save className="h-4 w-4" />
            保存设置
          </Button>
        </div>
      </div>
    </div>
  )
}
