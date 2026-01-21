# Исправление ошибки прав доступа IAM

## Проблема
```
An error occurred (UnauthorizedOperation) when calling the DescribeInstances operation: 
You are not authorized to perform this operation. 
User: arn:aws:iam::619071339378:user/my-bedrock-user is not authorized to perform: 
ec2:DescribeInstances because no permissions boundary allows the ec2:DescribeInstances action
```

Это означает, что ваш IAM пользователь `my-bedrock-user` не имеет прав для работы с EC2.

---

## Решение 1: Добавить права через AWS Console (Рекомендуется)

### Шаг 1: Переход в IAM
1. Войдите в [AWS Console](https://console.aws.amazon.com)
2. В поиске введите "IAM" и выберите **IAM**
3. В левом меню выберите **Users**
4. Найдите и откройте пользователя `my-bedrock-user`

### Шаг 2: Добавление политики EC2
1. Перейдите на вкладку **Permissions** (Разрешения)
2. Нажмите **Add permissions** → **Attach policies directly**
3. В поиске введите `AmazonEC2FullAccess`
4. Отметьте чекбокс **AmazonEC2FullAccess**
5. Нажмите **Next**, затем **Add permissions**

**Альтернатива (более безопасно):** Если нужны только минимальные права для работы с EC2:
- Найдите и выберите `AmazonEC2ReadOnlyAccess` (для просмотра)
- Или создайте кастомную политику с минимальными правами (см. ниже)

### Шаг 3: Проверка
После добавления прав подождите 1-2 минуты и попробуйте снова:
```bash
aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]' --output table
```

---

## Решение 2: Создать кастомную политику (Более безопасно)

Если вы хотите дать только необходимые права для работы с EC2:

### Шаг 1: Создание политики
1. В IAM Console выберите **Policies** в левом меню
2. Нажмите **Create policy**
3. Перейдите на вкладку **JSON**
4. Вставьте следующий JSON:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeVpcs",
                "ec2:DescribeKeyPairs",
                "ec2:DescribeImages",
                "ec2:RunInstances",
                "ec2:TerminateInstances",
                "ec2:StartInstances",
                "ec2:StopInstances",
                "ec2:RebootInstances",
                "ec2:CreateTags",
                "ec2:DescribeTags"
            ],
            "Resource": "*"
        }
    ]
}
```

5. Нажмите **Next**
6. **Policy name**: `CopfinderEC2Access`
7. **Description**: `EC2 permissions for Copfinder deployment`
8. Нажмите **Create policy**

### Шаг 2: Присоединение политики к пользователю
1. Вернитесь к пользователю `my-bedrock-user`
2. Перейдите на вкладку **Permissions**
3. Нажмите **Add permissions** → **Attach policies directly**
4. Найдите и выберите `CopfinderEC2Access`
5. Нажмите **Next**, затем **Add permissions**

---

## Решение 3: Использовать AWS Console вместо CLI

Если вы не можете изменить права IAM пользователя, используйте AWS Console напрямую:

1. Откройте [EC2 Console](https://console.aws.amazon.com/ec2/)
2. Перейдите в **Instances**
3. Найдите ваш инстанс и скопируйте:
   - **Instance ID** (например: `i-0123456789abcdef0`)
   - **Public IPv4 address** (например: `54.235.6.145`)

Затем используйте эти данные напрямую в скрипте развертывания, пропустив команды AWS CLI.

---

## Решение 4: Обновить скрипт для работы без AWS CLI

Если у вас нет прав для AWS CLI, можно обновить скрипт, чтобы он работал без команды `aws ec2 describe-instances`:

### Вариант A: Использовать IP напрямую
```bash
# Вместо получения IP через AWS CLI, используйте IP напрямую
export AWS_INSTANCE_ID="i-xxxxxxxxxxxxx"  # Из AWS Console
export PUBLIC_IP="54.235.6.145"  # Из AWS Console
export AWS_SSH_KEY="~/.ssh/copfinder-key.pem"
export AWS_SSH_USER="ec2-user"
```

Затем можно использовать IP напрямую для подключения и развертывания.

---

## Проверка прав

После добавления прав, проверьте:

```bash
# Проверка текущего пользователя
aws sts get-caller-identity

# Проверка прав на EC2
aws ec2 describe-instances --max-items 1
```

Если команды работают без ошибок - права настроены правильно.

---

## Минимальные права для развертывания

Для работы скрипта `ec2-deploy.sh` нужны следующие права:
- `ec2:DescribeInstances` - для получения IP адреса
- `ec2:DescribeInstanceStatus` - для проверки статуса
- `ec2:DescribeSecurityGroups` - для проверки Security Groups (опционально)

Для полного управления через AWS Console также полезны:
- `ec2:RunInstances` - для создания инстансов
- `ec2:TerminateInstances` - для удаления
- `ec2:StartInstances` / `ec2:StopInstances` - для управления

---

## Troubleshooting

### Проблема: Не могу изменить права пользователя
- Убедитесь, что вы вошли как администратор или имеете права `iam:AttachUserPolicy`
- Обратитесь к администратору AWS аккаунта

### Проблема: Права добавлены, но ошибка остается
- Подождите 1-2 минуты (права могут применяться с задержкой)
- Выйдите и войдите в AWS CLI заново: `aws configure`
- Проверьте, что используете правильный профиль: `aws configure list`

### Проблема: Нужны только права на чтение
- Используйте `AmazonEC2ReadOnlyAccess` вместо `AmazonEC2FullAccess`
- Или создайте кастомную политику только с `ec2:Describe*` действиями

---

## Быстрое решение (если есть доступ к AWS Console)

1. Откройте [IAM Console](https://console.aws.amazon.com/iam/)
2. Users → `my-bedrock-user` → Permissions
3. Add permissions → Attach policies directly
4. Найдите `AmazonEC2FullAccess` → выберите → Add permissions
5. Готово! Подождите 1-2 минуты и попробуйте снова

