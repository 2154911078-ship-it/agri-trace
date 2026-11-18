package com.agri.trace;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService implements CommandLineRunner {
  private final JdbcTemplate jdbc;
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  private final Map<String, Long> sessions = new ConcurrentHashMap<>();

  public AuthService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(String... args) {
    List<Long> ids = jdbc.queryForList("SELECT id FROM sys_user WHERE password LIKE '%PLACEHOLDER%'", Long.class);
    for (Long id : ids) {
      jdbc.update("UPDATE sys_user SET password = ? WHERE id = ?", encoder.encode("123456"), id);
    }
    if (!ids.isEmpty()) System.out.println("[agri] initialized demo passwords: admin / 123456");
  }

  public Map<String, Object> login(String username, String password) {
    if (username == null || username.isBlank() || password == null || password.isBlank())
      throw new ApiException("账号和密码都要填");
    List<Map<String, Object>> rows = jdbc.queryForList("""
        SELECT u.id, u.real_name AS name, u.password, u.enabled, r.name AS roleName
        FROM sys_user u LEFT JOIN sys_user_role ur ON ur.user_id = u.id
        LEFT JOIN sys_role r ON r.id = ur.role_id
        WHERE u.username = ? LIMIT 1
        """, username);
    if (rows.isEmpty()) throw new ApiException("账号或密码不正确");
    Map<String, Object> u = rows.get(0);
    if (Common.num(u.get("enabled")) != 1) throw new ApiException("账号已停用");
    String hash = Common.str(u.get("password"));
    if (hash == null || !encoder.matches(password, hash)) throw new ApiException("账号或密码不正确");
    jdbc.update("UPDATE sys_user SET last_login_at = ? WHERE id = ?",
        LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")), u.get("id"));
    String token = "real." + UUID.randomUUID();
    sessions.put(token, (long) Common.num(u.get("id")));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("token", token);
    out.put("name", u.get("name"));
    out.put("roleName", u.get("roleName") == null ? "合作社管理员" : u.get("roleName"));
    return out;
  }

  public long requireUser(String authorization) {
    String token = authorization == null ? null : authorization.replace("Bearer ", "").trim();
    Long uid = token == null ? null : sessions.get(token);
    if (uid == null) throw new ApiException("登录已失效，请重新登录", 401);
    return uid;
  }

  public Map<String, Object> me(String authorization) {
    long uid = requireUser(authorization);
    Map<String, Object> u = jdbc.queryForMap("""
        SELECT u.id, u.real_name AS name, u.username AS account, u.phone,
               r.name AS roleName, f.name AS farmName,
               DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS lastLogin
        FROM sys_user u
        LEFT JOIN sys_user_role ur ON ur.user_id = u.id
        LEFT JOIN sys_role r ON r.id = ur.role_id
        LEFT JOIN sys_user_farm uf ON uf.user_id = u.id
        LEFT JOIN farm f ON f.id = uf.farm_id
        WHERE u.id = ? LIMIT 1
        """, uid);
    if (u.get("lastLogin") == null) u.put("lastLogin", "未登录");
    return u;
  }

  public Map<String, Object> updateProfile(String authorization, String phone) {
    long uid = requireUser(authorization);
    if (phone != null) jdbc.update("UPDATE sys_user SET phone = ? WHERE id = ?", phone, uid);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (?, '系统', '更新个人资料', ?, '127.0.0.1')",
        uid, phone == null ? "" : phone);
    return me(authorization);
  }

  public void changePassword(String authorization, String oldPassword, String newPassword) {
    long uid = requireUser(authorization);
    if (newPassword == null || newPassword.length() < 6) throw new ApiException("新密码至少 6 位");
    String hash = jdbc.queryForObject("SELECT password FROM sys_user WHERE id = ?", String.class, uid);
    if (hash == null || oldPassword == null || !encoder.matches(oldPassword, hash))
      throw new ApiException("原密码不正确");
    jdbc.update("UPDATE sys_user SET password = ? WHERE id = ?", encoder.encode(newPassword), uid);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (?, '系统', '修改密码', '', '127.0.0.1')", uid);
  }

  public void logout(String authorization) {
    String token = authorization == null ? null : authorization.replace("Bearer ", "").trim();
    if (token != null) sessions.remove(token);
  }
}
