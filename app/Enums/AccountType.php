<?php

namespace App\Enums;

enum AccountType: string
{
    case Bank = 'bank';
    case EWallet = 'e_wallet';
    case Cash = 'cash';
    case Savings = 'savings';
    case Other = 'other';
}
