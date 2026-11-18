package com.agri.trace;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SysService {
  private final JdbcTemplate jdbc;
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  private final ObjectMapper json = new ObjectMapper();

  public SysService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Map<String, Object> page() {
    List<Map<String, Object>> users = jdbc.queryForList("""
        SELECT u.id, u.real_name AS name, u.username AS account, u.phone, u.enabled,
               DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS lastLogin,
               r.name AS role, f.name AS farm
        FROM sys_user u
        LEFT JOIN sys_user_role ur ON ur.user_id = u.id
        LEFT JOIN sys_role r ON r.id = ur.role_id
        LEFT JOIN sys_user_farm uf ON uf.user_id = u.id
        LEFT JOIN farm f ON f.id = uf.farm_id
        WHERE u.del_flag = 0
        GROUP BY u.id, u.real_name, u.username, u.phone, u.enabled, u.last_login_at, r.name, f.name
        ORDER BY u.id
        """);
    for (Map<String, Object> u : users) {
      u.put("status", Common.num(u.remove("enabled")) == 1 ? "active" : "disabled");
      if (u.get("lastLogin") == null) u.put("lastLogin", "未登录");
      if (u.get("farm") == null) u.put("farm", "—");
    }

    List<Map<String, Object>> roleRows = jdbc.queryForList(
        "SELECT id, name, code, perm_json AS perms FROM sys_role ORDER BY id");
    Map<String, String> descOf = Map.of(
        "合作社管理员", "全部模块与数据权限",
        "农艺师", "生产记录与地块管理",
        "质检员", "检测单与批次锁定",
        "仓管", "赋码、出入库与物流",
        "司机", "运输单与签收");
    List<Map<String, Object>> roles = new ArrayList<>();
    for (Map<String, Object> r : roleRows) {
      Map<String, Object> role = new LinkedHashMap<>();
      String name = Common.str(r.get("name"));
      role.put("key", Common.str(r.get("code")).toLowerCase());
      role.put("name", name);
      role.put("desc", descOf.getOrDefault(name, "业务角色"));
      role.put("users", users.stream().filter(u -> name.equals(u.get("role"))).count());
      try {
        role.put("permissions", json.readValue(Common.str(r.get("perms")), List.class));
      } catch (Exception e) {
        role.put("permissions", List.of());
      }
      roles.add(role);
    }

    List<Map<String, Object>> farms = jdbc.queryForList("""
        SELECT f.id, f.name, COUNT(p.id) AS plots, ROUND(COALESCE(SUM(p.area_mu), 0), 1) AS areaMu,
               COALESCE(f.contact, '张耕') AS manager, COALESCE(f.address, '') AS address
        FROM farm f LEFT JOIN plot p ON p.farm_id = f.id
        GROUP BY f.id, f.name, f.contact, f.address ORDER BY f.id
        """);

    List<Map<String, Object>> logs = jdbc.queryForList("""
        SELECT l.id, DATE_FORMAT(l.create_time, '%Y-%m-%d %H:%i') AS time, COALESCE(u.real_name, '系统') AS user,
               l.action, COALESCE(l.params, '') AS target, COALESCE(l.ip, '') AS ip
        FROM op_log l LEFT JOIN sys_user u ON u.id = l.user_id
        ORDER BY l.id DESC LIMIT 30
        """);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("users", users);
    out.put("roles", roles);
    out.put("farms", farms);
    out.put("logs", logs);
    return out;
  }

  public Map<String, Object> createUser(Map<String, Object> body) {
    String name = Common.str(body.get("name"));
    String account = Common.str(body.get("account"));
    if (name == null || name.isBlank() || account == null || account.isBlank())
      throw new ApiException("姓名和账号必填");
    Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM sys_user WHERE username = ?", Integer.class, account);
    if (exists != null && exists > 0) throw new ApiException("账号已存在");
    String roleName = Common.str(body.getOrDefault("role", "农艺师"));
    String farmName = Common.str(body.getOrDefault("farm", "青禾家庭农场"));
    Integer roleId = jdbc.query("SELECT id FROM sys_role WHERE name = ? LIMIT 1",
        rs -> rs.next() ? rs.getInt(1) : null, roleName);
    if (roleId == null) {
      roleId = jdbc.query("SELECT id FROM sys_role WHERE name = '农艺师' LIMIT 1",
          rs -> rs.next() ? rs.getInt(1) : null);
    }
    Integer farmId = jdbc.query("SELECT id FROM farm WHERE name = ? LIMIT 1",
        rs -> rs.next() ? rs.getInt(1) : null, farmName);
    org.springframework.jdbc.support.GeneratedKeyHolder key = new org.springframework.jdbc.support.GeneratedKeyHolder();
    Integer rid = roleId;
    jdbc.update(con -> {
      var ps = con.prepareStatement("""
          INSERT INTO sys_user (username, password, real_name, phone, enabled)
          VALUES (?, ?, ?, ?, 1)
          """, java.sql.Statement.RETURN_GENERATED_KEYS);
      ps.setString(1, account);
      ps.setString(2, encoder.encode("123456"));
      ps.setString(3, name);
      ps.setString(4, Common.str(body.get("phone")));
      return ps;
    }, key);
    long uid = key.getKey().longValue();
    if (rid != null) jdbc.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", uid, rid);
    if (farmId != null) jdbc.update("INSERT INTO sys_user_farm (user_id, farm_id) VALUES (?, ?)", uid, farmId);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '系统', '新增用户', ?, '127.0.0.1')",
        name + " · " + roleName);
    return userOf(uid);
  }

  public Map<String, Object> toggleUser(long id) {
    jdbc.update("UPDATE sys_user SET enabled = 1 - enabled WHERE id = ?", id);
    Map<String, Object> u = userOf(id);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (1, '系统', ?, ?, '127.0.0.1')",
        "active".equals(u.get("status")) ? "启用用户" : "停用用户", u.get("name"));
    return u;
  }

  private Map<String, Object> userOf(long id) {
    java.util.List<java.util.Map<String, Object>> rows = jdbc.queryForList("""
        SELECT u.id, u.real_name AS name, u.username AS account, u.phone, u.enabled,
               DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS lastLogin,
               r.name AS role, f.name AS farm
        FROM sys_user u
        LEFT JOIN sys_user_role ur ON ur.user_id = u.id
        LEFT JOIN sys_role r ON r.id = ur.role_id
        LEFT JOIN sys_user_farm uf ON uf.user_id = u.id
        LEFT JOIN farm f ON f.id = uf.farm_id
        WHERE u.id = ? LIMIT 1
        """, id);
    if (rows.isEmpty()) throw new ApiException("用户不存在", 404);
    Map<String, Object> u = rows.get(0);
    u.put("status", Common.num(u.remove("enabled")) == 1 ? "active" : "disabled");
    if (u.get("lastLogin") == null) u.put("lastLogin", "未登录");
    return u;
  }
}
