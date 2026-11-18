package com.agri.trace;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiAdvice {
  @ExceptionHandler(ApiException.class)
  public Map<String, Object> api(ApiException e) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("code", e.code);
    m.put("msg", e.getMessage());
    return m;
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public Map<String, Object> notFound(NoResourceFoundException e) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("code", 404);
    m.put("msg", "接口不存在：/" + e.getResourcePath());
    return m;
  }

  @ExceptionHandler(Exception.class)
  public Map<String, Object> other(Exception e) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("code", 500);
    m.put("msg", e.getMessage() == null ? "服务器内部错误" : e.getMessage());
    return m;
  }
}
