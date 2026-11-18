package com.agri.trace;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Hidden
@RestController
public class IndexController {
  @GetMapping("/")
  public void index(HttpServletResponse response) throws IOException {
    response.sendRedirect("http://127.0.0.1:5181/");
  }
}
