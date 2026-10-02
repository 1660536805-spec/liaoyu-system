#!/usr/bin/env bash
# 生成本地 HTTPS 证书（供手机局域网访问摄像头用）
#
# 为什么不用 vite 的自签名证书：
#   vite basic-ssl 用的是 CN=example.org 的通用自签名证书，
#   iOS Safari 会直接拒绝加载（连「继续访问」都不给），
#   因为自签名证书无法验证签发链。
#   必须用「自建 CA 签发 + 证书内含根 CA」的链，iOS 才认。
#
# 产物（都在 certs/ 下）：
#   rootCA.crt         ← 装到手机「设置 → 通用 → VPN与设备管理」并信任
#   server.crt/.key    ← vite 用的服务器证书
#   mkcert-mobile.txt  ← 手机端操作步骤
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT/certs"
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

IP="192.168.1.209"
HOSTS="localhost,127.0.0.1,$IP"

echo "=== 1/4 生成根 CA（有效期 10 年）==="
if [ ! -f rootCA.key ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
    -keyout rootCA.key -out rootCA.crt \
    -subj "/C=CN/ST=Local/L=Local/O=Xianyang Dev CA/CN=Xianyang Dev Root CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
  echo "  ✓ 根 CA 已生成"
else
  echo "  · 根 CA 已存在，跳过"
fi

echo "=== 2/4 生成服务器私钥 ==="
openssl genrsa -out server.key 2048 2>/dev/null
echo "  ✓ server.key"

echo "=== 3/4 生成 CSR ==="
cat > san.cnf <<EOF
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no
[dn]
C = CN
ST = Local
L = Local
O = Xianyang
CN = $IP
[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt
[alt]
IP.1 = 192.168.1.209
IP.2 = 127.0.0.1
IP.3 = 0.0.0.0
DNS.1 = localhost
DNS.2 = *.local
EOF
openssl req -new -key server.key -out server.csr -config san.cnf 2>/dev/null
echo "  ✓ server.csr"

echo "=== 4/4 用根 CA 签发服务器证书（有效期 825 天，iOS/Safari 上限）==="
cat > ext.cnf <<EOF
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt
authorityKeyIdentifier = keyid,issuer
[alt]
IP.1 = 192.168.1.209
IP.2 = 127.0.0.1
IP.3 = 0.0.0.0
DNS.1 = localhost
DNS.2 = *.local
EOF
openssl x509 -req -in server.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile ext.cnf 2>/dev/null

echo
echo "✓ 全部完成，产物在 $CERT_DIR"
echo
openssl x509 -in server.crt -noout -subject -issuer -dates
echo
echo "=== 校验链是否完整（应显示 verify OK）==="
openssl verify -CAfile rootCA.crt server.crt
