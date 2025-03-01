import http.server
import socketserver
import json
import yaml
from urllib.parse import urlparse

PORT = 8080
YAML_FILE = "params.yaml"

class YAMLRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path).path
        if parsed_path == "/get_yaml":
            try:
                with open(YAML_FILE, 'r') as f:
                    yaml_data = yaml.safe_load(f)
                    json_data = json.dumps(yaml_data)
                    self.send_response(200)
                    self.send_header("Content-type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")  # Adding CORS header
                    self.end_headers()
                    self.wfile.write(json_data.encode())
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("", PORT), YAMLRequestHandler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
