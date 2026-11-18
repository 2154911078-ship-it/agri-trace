package com.agri.trace;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
  @Bean
  public OpenAPI agriOpenApi() {
    return new OpenAPI().info(new Info()
        .title("青禾农业 · 溯源系统 API")
        .version("0.1.0")
        .description("3 基地 / 48 地块 / 批次 · 生产 · 质检 · 赋码 · 物流 · 追溯 的读写接口。"
            + "登录后其余接口可直接调用（本地演示未强制鉴权）。"));
  }
}
