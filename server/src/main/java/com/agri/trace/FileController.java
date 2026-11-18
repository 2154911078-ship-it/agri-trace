package com.agri.trace;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class FileController {
  private final JdbcTemplate jdbc;
  private final AuthService auth;
  @Value("${app.upload-dir:uploads}")
  private String uploadDir;

  public FileController(JdbcTemplate jdbc, AuthService auth) {
    this.jdbc = jdbc;
    this.auth = auth;
  }

  private Path reportDir() throws IOException {
    Path dir = Paths.get(uploadDir, "reports").toAbsolutePath().normalize();
    Files.createDirectories(dir);
    return dir;
  }

  @PostMapping("/inspects/{id}/report")
  public Map<String, Object> upload(
      @PathVariable long id,
      @RequestParam("file") MultipartFile file,
      @RequestHeader(value = "Authorization", required = false) String header) throws IOException {
    long uid = auth.requireUser(header);
    if (file == null || file.isEmpty()) throw new ApiException("请选择报告文件");
    if (file.getSize() > 10 * 1024 * 1024) throw new ApiException("报告文件不能超过 10MB");
    String original = file.getOriginalFilename() == null ? "report.pdf" : file.getOriginalFilename();
    String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1).toLowerCase() : "pdf";
    if (!ext.matches("pdf|png|jpg|jpeg")) throw new ApiException("仅支持 PDF / PNG / JPG");
    String name = id + "_" + System.currentTimeMillis() + "." + ext;
    file.transferTo(reportDir().resolve(name).toFile());
    String url = "/api/files/reports/" + name;
    int updated = jdbc.update("""
        UPDATE quality_inspect SET report_url = ?, report_size = ?, archive_status = 1,
               archive_at = NOW(), archive_user = ? WHERE id = ?
        """, url, String.format("%.0fKB", Math.max(1, file.getSize() / 1024.0)), uid, id);
    if (updated == 0) throw new ApiException("检测单不存在", 404);
    jdbc.update("INSERT INTO op_log (user_id, module, action, params, ip) VALUES (?, '质检', '上传检测报告', ?, '127.0.0.1')",
        uid, "inspect#" + id);
    return Common.ok(Common.map("id", id, "reportUrl", url,
        "reportSize", String.format("%.0fKB", Math.max(1, file.getSize() / 1024.0)), "archiveStatus", 1));
  }

  @GetMapping("/files/reports/{name}")
  public ResponseEntity<Resource> file(@PathVariable String name) throws IOException {
    if (!name.matches("[A-Za-z0-9._-]+")) throw new ApiException("文件名不合法", 404);
    Path f = reportDir().resolve(name).normalize();
    if (!f.startsWith(reportDir()) || !Files.exists(f)) throw new ApiException("报告不存在", 404);
    MediaType type = name.endsWith(".pdf") ? MediaType.APPLICATION_PDF
        : name.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
    return ResponseEntity.ok().contentType(type)
        .header("Content-Disposition", "inline; filename=\"" + name + "\"")
        .body(new FileSystemResource(f));
  }
}
