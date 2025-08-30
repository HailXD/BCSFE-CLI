set VERSION=1.1

docker build -t web-bcsfe:%VERSION% .
docker tag web-bcsfe:%VERSION% hailxd/web-bcsfe:%VERSION%
docker push hailxd/web-bcsfe:%VERSION%
