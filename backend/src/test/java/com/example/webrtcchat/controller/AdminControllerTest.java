package com.example.webrtcchat.controller;

import com.example.webrtcchat.dto.AdminStatsDto;
import com.example.webrtcchat.service.AdminService;
import com.example.webrtcchat.service.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminService adminService;

    @MockBean
    private JwtService jwtService;

    @Test
    @DisplayName("GET /api/admin/stats - returns all statistics")
    void getStats_success() throws Exception {
        AdminStatsDto stats = new AdminStatsDto(42, 7, 15, 5, 3, 12);
        when(adminService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(42))
                .andExpect(jsonPath("$.onlineUsers").value(7))
                .andExpect(jsonPath("$.totalChats").value(15))
                .andExpect(jsonPath("$.activeChats").value(5))
                .andExpect(jsonPath("$.groupChats").value(3))
                .andExpect(jsonPath("$.directChats").value(12));
    }

    @Test
    @DisplayName("GET /api/admin/stats - returns zeros when empty")
    void getStats_empty() throws Exception {
        AdminStatsDto stats = new AdminStatsDto(0, 0, 0, 0, 0, 0);
        when(adminService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(0))
                .andExpect(jsonPath("$.onlineUsers").value(0))
                .andExpect(jsonPath("$.totalChats").value(0))
                .andExpect(jsonPath("$.activeChats").value(0))
                .andExpect(jsonPath("$.groupChats").value(0))
                .andExpect(jsonPath("$.directChats").value(0));
    }
}
