package exple1;

import java.io.IOException;
import java.io.PrintWriter;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class GreetingServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("text/html; charset=ISO-8859-1");
        PrintWriter out = response.getWriter();

        String nomPrenom = "Anonymous";
        String votreNom = request.getParameter("nom");
        if (votreNom != null && !votreNom.isEmpty()) {
            nomPrenom = votreNom.toUpperCase();
        }

        out.println("<!DOCTYPE html>");
        out.println("<html><head><title>Greetings Servlet</title></head>");
        out.println("<body bgcolor=\"#FDF5E6\">");
        out.println("<h1>Greetings " + nomPrenom + "!</h1>");
        out.println("<p>Vous avez gagne: " + (Math.random() * 10) + " millions de dollars!</p>");
        out.println("</body></html>");
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doGet(request, response);
    }
}
