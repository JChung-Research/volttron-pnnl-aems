IMG_NAME=volttron

COMMAND_RUN=docker run \
	  --name ${IMG_NAME} \
	  --detach=false \
	  --network host \
	  --rm \
	  -i \
	  -t \
	  ${IMG_NAME} /bin/bash -c

build:
	docker build -f Dockerfile_volttron --network host --no-cache --rm -t ${IMG_NAME} .

remove-image:
	docker rmi ${IMG_NAME}

run:
	$(COMMAND_RUN) \
            "cd /home/volttron/volttron && bash"
