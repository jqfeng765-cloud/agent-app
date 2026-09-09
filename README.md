# agent-app

Linear: FJQ-53
Linear: FJQ-48

## FJQ-48 用户敏感字段权限

普通用户不能通过前台管理或接口改自己的**机构 / 密码 / 角色**，也不能删除用户。管理员仍可操作这些字段。

```bash
npm test
npm start
```

演示账号：`alice / alice123`（普通用户）、`admin / admin123`（管理员）。
