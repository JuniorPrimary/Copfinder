# Terraform конфигурация для развертывания Copfinder на AWS ECS
# Использование: terraform init && terraform plan && terraform apply

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "copfinder-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "copfinder-igw"
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "copfinder-public-subnet"
  }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "copfinder-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "ecs" {
  name        = "copfinder-ecs-sg"
  description = "Security group for Copfinder ECS tasks"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "copfinder-ecs-sg"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "copfinder" {
  name              = "/ecs/copfinder"
  retention_in_days = 7

  tags = {
    Name = "copfinder-logs"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = var.ecs_cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = var.ecs_cluster_name
  }
}

# ECR Repository
resource "aws_ecr_repository" "copfinder" {
  name                 = var.ecr_repo_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = var.ecr_repo_name
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution" {
  name = "copfinder-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task" {
  name = "copfinder-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# ECS Task Definition
resource "aws_ecs_task_definition" "copfinder" {
  family                   = "copfinder"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "copfinder"
      image     = "${aws_ecr_repository.copfinder.repository_url}:latest"
      essential = true

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        }
      ]

      secrets = [
        {
          name      = "COPART_TELEGRAM_BOT_TOKEN"
          valueFrom = aws_secretsmanager_secret.copart_bot_token.arn
        },
        {
          name      = "COPART_TELEGRAM_CHAT_ID"
          valueFrom = aws_secretsmanager_secret.copart_chat_id.arn
        },
        {
          name      = "TELEGRAM_BOT_TOKEN"
          valueFrom = aws_secretsmanager_secret.iaai_bot_token.arn
        },
        {
          name      = "TELEGRAM_CHAT_ID"
          valueFrom = aws_secretsmanager_secret.iaai_chat_id.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.copfinder.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "copfinder-task"
  }
}

# ECS Service
resource "aws_ecs_service" "copfinder" {
  name            = var.ecs_service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.copfinder.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public.id]
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution
  ]

  tags = {
    Name = var.ecs_service_name
  }
}

# Secrets Manager (пример - создайте секреты вручную или через другой механизм)
resource "aws_secretsmanager_secret" "copart_bot_token" {
  name = "copfinder/copart-bot-token"
}

resource "aws_secretsmanager_secret" "copart_chat_id" {
  name = "copfinder/copart-chat-id"
}

resource "aws_secretsmanager_secret" "iaai_bot_token" {
  name = "copfinder/iaai-bot-token"
}

resource "aws_secretsmanager_secret" "iaai_chat_id" {
  name = "copfinder/iaai-chat-id"
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
  default     = "copfinder-cluster"
}

variable "ecs_service_name" {
  description = "ECS service name"
  type        = string
  default     = "copfinder-service"
}

variable "ecr_repo_name" {
  description = "ECR repository name"
  type        = string
  default     = "copfinder"
}

variable "task_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 1024
}

variable "task_memory" {
  description = "Memory for ECS task"
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

# Outputs
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.copfinder.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.copfinder.repository_url
}

