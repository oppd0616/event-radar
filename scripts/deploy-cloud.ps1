param(
  [string[]]$Functions = @(
    'fetchEvents',
    'getEvents',
    'manageFollows',
    'recordSignal',
    'updatePreference',
    'addSubscriptionQuota',
    'sendSubscribeMessages'
  )
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$functionRoot = Join-Path $projectRoot 'cloudfunctions'
$envId = 'cloud1-d3gm0lbv1392513d1'

Write-Host ''
Write-Host '活动雷达 · 云函数一键部署' -ForegroundColor Cyan
Write-Host "目标环境：$envId"

$tcb = Get-Command tcb -ErrorAction SilentlyContinue
if (-not $tcb) {
  Write-Host ''
  Write-Host '尚未安装腾讯云官方 CloudBase CLI。请先运行：' -ForegroundColor Yellow
  Write-Host 'npm install -g @cloudbase/cli'
  Write-Host 'tcb login'
  Write-Host ''
  Write-Host '完成一次登录授权后，再双击 deploy-cloud.cmd。'
  exit 2
}

$available = Get-ChildItem -LiteralPath $functionRoot -Directory | Select-Object -ExpandProperty Name
$targets = $Functions | Where-Object { $_ } | Select-Object -Unique
if (-not $targets.Count) {
  throw '没有指定要部署的云函数。'
}

foreach ($functionName in $targets) {
  if ($available -notcontains $functionName) {
    throw "本地不存在云函数：$functionName"
  }
}

Write-Host ''
Write-Host ('准备部署：' + ($targets -join '、'))

foreach ($functionName in $targets) {
  $functionDir = Join-Path $functionRoot $functionName
  $entryFile = Join-Path $functionDir 'index.js'
  if (-not (Test-Path -LiteralPath $entryFile)) {
    throw "$functionName 缺少 index.js"
  }

  Write-Host ''
  Write-Host "[$functionName] 检查语法..." -ForegroundColor DarkCyan
  & node --check $entryFile
  if ($LASTEXITCODE -ne 0) {
    throw "$functionName 语法检查失败，已停止部署。"
  }

  Write-Host "[$functionName] 上传代码..." -ForegroundColor DarkCyan
  & tcb fn code update $functionName --dir $functionDir --env-id $envId --yes
  if ($LASTEXITCODE -ne 0) {
    throw "$functionName 部署失败。前面的函数可能已经成功，请根据上方结果检查。"
  }

  $configFile = Join-Path $functionDir 'config.json'
  if (Test-Path -LiteralPath $configFile) {
    $functionConfig = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
    if ($functionConfig.triggers) {
      Write-Host "[$functionName] 核对定时触发器..." -ForegroundColor DarkCyan
      $detailOutput = & tcb -e $envId fn detail $functionName --json
      if ($LASTEXITCODE -ne 0) {
        throw "$functionName 触发器状态读取失败，已停止部署。"
      }
      $detail = ($detailOutput -join "`n") | ConvertFrom-Json
      $remoteTriggers = @($detail.data.Triggers | Where-Object { $_ })
      foreach ($trigger in $functionConfig.triggers) {
        if ($trigger.type -ne 'timer') {
          throw "$functionName 存在未支持的触发器类型：$($trigger.type)"
        }
        $remote = $remoteTriggers | Where-Object { $_.TriggerName -eq $trigger.name } | Select-Object -First 1
        if ($remote) {
          $remoteConfig = $remote.TriggerDesc | ConvertFrom-Json
          if ($remote.Type -ne 'timer' -or $remoteConfig.cron -ne $trigger.config) {
            throw "$functionName 的 $($trigger.name) 与本地配置不一致，请先人工核对；不会自动删除或覆盖线上触发器。"
          }
          Write-Host "[$functionName] $($trigger.name) 已存在" -ForegroundColor DarkCyan
          continue
        }
        & tcb -e $envId fn trigger create $functionName --trigger-name $trigger.name --cron $trigger.config
        if ($LASTEXITCODE -ne 0) {
          throw "$functionName 的 $($trigger.name) 创建失败，已停止部署。"
        }
        Write-Host "[$functionName] $($trigger.name) 已创建" -ForegroundColor Green
      }
    }
  }

  Write-Host "[$functionName] 完成" -ForegroundColor Green
}

Write-Host ''
Write-Host '云函数部署全部完成。' -ForegroundColor Green
Write-Host '前端页面修改仍需在微信开发者工具中重新编译；正式发布仍需上传版本并提交微信审核。'
